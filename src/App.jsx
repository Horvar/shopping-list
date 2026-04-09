import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from './firebase'
import {
    collection, addDoc, deleteDoc, updateDoc,
    doc, onSnapshot, query, orderBy, setDoc, getDoc, getDocs
} from 'firebase/firestore'

const LONG_PRESS_MS = 500
const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'уп', 'своя']

// ─── Hooks ─────────────────────────────────────────────────────────
function useLongPress(onLongPress, onClick, ms = LONG_PRESS_MS) {
    const timerRef = useRef(null)
    const firedRef = useRef(false)
    const movedRef = useRef(false)

    const start = useCallback((e) => {
        movedRef.current = false
        firedRef.current = false
        timerRef.current = setTimeout(() => {
            if (!movedRef.current) { firedRef.current = true; onLongPress(e) }
        }, ms)
    }, [onLongPress, ms])

    const move = useCallback(() => { movedRef.current = true; clearTimeout(timerRef.current) }, [])
    const cancel = useCallback(() => clearTimeout(timerRef.current), [])
    const handleClick = useCallback((e) => {
        if (firedRef.current) { firedRef.current = false; return }
        onClick(e)
    }, [onClick])

    return { onTouchStart: start, onTouchMove: move, onTouchEnd: cancel, onClick: handleClick }
}

// ─── Context Menu ──────────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose }) {
    const menuRef = useRef(null)
    const [pos, setPos] = useState({ x, y })

    useEffect(() => {
        if (menuRef.current) {
            const { offsetWidth: w, offsetHeight: h } = menuRef.current
            setPos({ x: Math.min(x, window.innerWidth - w - 8), y: Math.min(y, window.innerHeight - h - 8) })
        }
        const close = () => onClose()
        window.addEventListener('mousedown', close)
        return () => window.removeEventListener('mousedown', close)
    }, [x, y, onClose])

    return (
        <div ref={menuRef} className="ctx-menu" style={{ left: pos.x, top: pos.y }} onMouseDown={e => e.stopPropagation()}>
            {items.map((item, i) => item === 'divider'
                ? <div key={i} className="ctx-divider" />
                : <div key={i} className={`ctx-item ${item.danger ? 'danger' : ''}`} onClick={() => { item.action(); onClose() }}>
                    <span className="ctx-icon">{item.icon}</span>{item.label}
                </div>
            )}
        </div>
    )
}

// ─── Bottom Sheet ──────────────────────────────────────────────────
function BottomSheet({ title, items, onClose }) {
    return (
        <div className="sheet-overlay" onClick={onClose}>
            <div className="bottom-sheet" onClick={e => e.stopPropagation()}>
                <div className="sheet-handle" />
                {title && <div className="sheet-title">{title}</div>}
                {items.map((item, i) => item === 'divider'
                    ? <div key={i} className="ctx-divider" style={{ margin: '4px 20px' }} />
                    : <div key={i} className={`sheet-item ${item.danger ? 'danger' : ''}`} onClick={() => { item.action(); onClose() }}>
                        <span className="sheet-icon">{item.icon}</span>{item.label}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── CatalogItem ───────────────────────────────────────────────────
function CatalogItem({ product, inList, stores, types, onToggle, onContextMenu, onLongPress }) {
    const handlers = useLongPress(onLongPress, onToggle)
    const productStores = (product.stores || []).map(id => stores.find(s => s.id === id)?.name).filter(Boolean)
    const productTypes = (product.types || []).map(id => types.find(t => t.id === id)?.name).filter(Boolean)
    const tags = [...productTypes, ...productStores]

    return (
        <div className={`item ${inList ? 'in-list' : ''}`} onContextMenu={onContextMenu} {...handlers}>
            <div className="item-check">{inList && '✓'}</div>
            <span className="item-name">{product.name}</span>
            {tags.length > 0 && (
                <div className="item-tags">
                    {tags.slice(0, 3).map((t, i) => <span key={i} className="item-tag">{t}</span>)}
                </div>
            )}
        </div>
    )
}

// ─── Settings Panel ────────────────────────────────────────────────
function SettingsPanel({ stores, types, onClose }) {
    const [newStore, setNewStore] = useState('')
    const [newType, setNewType] = useState('')

    const addStore = async () => {
        if (!newStore.trim()) return
        await addDoc(collection(db, 'stores'), { name: newStore.trim(), createdAt: Date.now() })
        setNewStore('')
    }

    const addType = async () => {
        if (!newType.trim()) return
        await addDoc(collection(db, 'types'), { name: newType.trim(), createdAt: Date.now() })
        setNewType('')
    }

    const delStore = async (id) => await deleteDoc(doc(db, 'stores', id))
    const delType = async (id) => await deleteDoc(doc(db, 'types', id))

    return (
        <>
            <div className="settings-overlay" onClick={onClose} />
            <div className="settings-panel">
                <div className="settings-header">
                    <span className="settings-title">Настройки</span>
                    <button className="icon-btn" onClick={onClose}>✕</button>
                </div>
                <div className="settings-body">
                    <div>
                        <div className="settings-section-title">Магазины</div>
                        <div className="tag-list">
                            {stores.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--muted2)' }}>Нет магазинов</div>}
                            {[...stores].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(s => (
                                <div key={s.id} className="tag-row">
                                    <span className="tag-row-name">{s.name}</span>
                                    <button className="tag-row-icon" onClick={() => delStore(s.id)}>✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="tag-add-row">
                            <input className="tag-input" value={newStore} placeholder="Название магазина"
                                   onChange={e => setNewStore(e.target.value)}
                                   onKeyDown={e => e.key === 'Enter' && addStore()} />
                            <button className="tag-add-btn" onClick={addStore}>+ Добавить</button>
                        </div>
                    </div>

                    <div>
                        <div className="settings-section-title">Типы товаров</div>
                        <div className="tag-list">
                            {types.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--muted2)' }}>Нет типов</div>}
                            {[...types].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(t => (
                                <div key={t.id} className="tag-row">
                                    <span className="tag-row-name">{t.name}</span>
                                    <button className="tag-row-icon" onClick={() => delType(t.id)}>✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="tag-add-row">
                            <input className="tag-input" value={newType} placeholder="Название типа"
                                   onChange={e => setNewType(e.target.value)}
                                   onKeyDown={e => e.key === 'Enter' && addType()} />
                            <button className="tag-add-btn" onClick={addType}>+ Добавить</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

// ─── Drag-to-scroll ────────────────────────────────────────────────
function useDragScroll() {
    const ref = useRef(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        let isDown = false, startX, scrollLeft
        const onDown = (e) => {
            isDown = true
            el.classList.add('dragging')
            startX = e.pageX - el.offsetLeft
            scrollLeft = el.scrollLeft
        }
        const onUp = () => { isDown = false; el.classList.remove('dragging') }
        const onMove = (e) => {
            if (!isDown) return
            e.preventDefault()
            el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX)
        }
        el.addEventListener('mousedown', onDown)
        el.addEventListener('mouseleave', onUp)
        el.addEventListener('mouseup', onUp)
        el.addEventListener('mousemove', onMove)
        return () => {
            el.removeEventListener('mousedown', onDown)
            el.removeEventListener('mouseleave', onUp)
            el.removeEventListener('mouseup', onUp)
            el.removeEventListener('mousemove', onMove)
        }
    }, [])
    return ref
}

// ─── Filter rows ───────────────────────────────────────────────────
function FilterRows({ stores, types, activeStores, activeTypes, onToggleStore, onToggleType, checklist }) {
    if (stores.length === 0 && types.length === 0) return null

    const countByStore = {}
    const countByType = {}
    if (checklist) {
        checklist.filter(c => !c.done).forEach(item => {
            const itemStores = Array.isArray(item.stores) ? item.stores : []
            const itemTypes = Array.isArray(item.types) ? item.types : []
            itemStores.forEach(sid => { countByStore[sid] = (countByStore[sid] || 0) + 1 })
            itemTypes.forEach(tid => { countByType[tid] = (countByType[tid] || 0) + 1 })
        })
    }

    const hasAnyCounts = Object.keys(countByStore).length > 0 || Object.keys(countByType).length > 0

    const sortItems = (items, countMap) => {
        const alpha = (a, b) => a.name.localeCompare(b.name, 'ru')
        if (!checklist || !hasAnyCounts) return [...items].sort(alpha)
        // by count desc, then alpha
        return [...items].sort((a, b) => {
            const ca = countMap[a.id] || 0
            const cb = countMap[b.id] || 0
            if (cb !== ca) return cb - ca
            return alpha(a, b)
        })
    }

    const sortedTypes = sortItems(types, countByType)
    const sortedStores = sortItems(stores, countByStore)

    const typeChipsRef = useDragScroll()
    const storeChipsRef = useDragScroll()

    return (
        <div className="filter-section">
            {sortedTypes.length > 0 && (
                <div className="filter-row">
                    <span className="filter-row-label">Тип</span>
                    <div className="filter-chips" ref={typeChipsRef}>
                        {sortedTypes.map(t => {
                            const count = checklist ? countByType[t.id] : null
                            return (
                                <button key={t.id} className={`chip ${activeTypes.includes(t.id) ? 'active' : ''}`} onClick={() => onToggleType(t.id)}>
                                    {t.name}{count ? <span className="chip-count">{count}</span> : null}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
            {sortedStores.length > 0 && (
                <div className="filter-row">
                    <span className="filter-row-label">Магазин</span>
                    <div className="filter-chips" ref={storeChipsRef}>
                        {sortedStores.map(s => {
                            const count = checklist ? countByStore[s.id] : null
                            return (
                                <button key={s.id} className={`chip ${activeStores.includes(s.id) ? 'active' : ''}`} onClick={() => onToggleStore(s.id)}>
                                    {s.name}{count ? <span className="chip-count">{count}</span> : null}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── CommentText — показывает текст снизу и редактирует его ──────
function CommentText({ item, editingId, setEditingId }) {
    const [val, setVal] = useState(item.comment || '')
    const isEditing = editingId === item.id

    useEffect(() => { setVal(item.comment || '') }, [item.comment])

    const save = async () => {
        setEditingId(null)
        if (val === (item.comment || '')) return
        await updateDoc(doc(db, 'checklist', item.id), { comment: val })
    }

    if (isEditing) {
        return (
            <input
                className="cl-comment-input-below"
                value={val}
                onChange={e => setVal(e.target.value)}
                onBlur={save}
                onKeyDown={e => {
                    if (e.key === 'Enter') save()
                    if (e.key === 'Escape') { setVal(item.comment || ''); setEditingId(null) }
                }}
                onClick={e => e.stopPropagation()}
                autoFocus
                placeholder="Комментарий..."
            />
        )
    }

    if (!item.comment) return null

    return (
        <div className="cl-comment-below" onClick={e => { e.stopPropagation(); setEditingId(item.id) }}>
            {item.comment}
        </div>
    )
}

// ─── CommentBtn — кнопка карандаша ───────────────────────────────
function CommentBtn({ item, editingId, setEditingId }) {
    const hasComment = !!item.comment
    const isEditing = editingId === item.id

    return (
        <button
            className={`cl-comment-btn ${hasComment || isEditing ? 'has-comment' : ''}`}
            onClick={e => { e.stopPropagation(); setEditingId(isEditing ? null : item.id) }}
            title={hasComment ? item.comment : 'Добавить комментарий'}
        >✎</button>
    )
}

// ─── QtyInput ──────────────────────────────────────────────────────
function QtyInput({ item, autoFocus }) {
    const [val, setVal] = useState(item.qty || '')

    const save = async () => {
        if (val === (item.qty || '')) return
        await updateDoc(doc(db, 'checklist', item.id), { qty: val })
    }

    return (
        <div className="qty-wrap" onClick={e => e.stopPropagation()}>
            <input
                className="qty-input"
                value={val}
                onChange={e => setVal(e.target.value)}
                onBlur={save}
                onKeyDown={e => { if (e.key === 'Enter') { save(); e.target.blur() } }}
                autoFocus={autoFocus}
                placeholder="—"
            />
            {item.unit
                ? <span className="qty-unit">{item.unit}</span>
                : <span className="qty-unit" />
            }
        </div>
    )
}

// ─── ImageUpload ───────────────────────────────────────────────────
function compressImage(file, maxSize = 800, quality = 0.75) {
    return new Promise((resolve) => {
        const img = new Image()
        const url = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(url)
            let { width, height } = img
            if (width > height) {
                if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize }
            } else {
                if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize }
            }
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            canvas.getContext('2d').drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.src = url
    })
}

function ImageUpload({ currentImage, onUploaded, onRemoved }) {
    const [loading, setLoading] = useState(false)
    const inputRef = useRef(null)

    const handleFile = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setLoading(true)
        try {
            const base64 = await compressImage(file)
            onUploaded(base64)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleRemove = (e) => {
        e.stopPropagation()
        onRemoved()
        if (inputRef.current) inputRef.current.value = ''
    }

    if (currentImage) {
        return (
            <div className="img-upload-preview">
                <img src={currentImage} alt="" className="img-preview" />
                <button className="img-remove-btn" onClick={handleRemove}>✕ Удалить фото</button>
            </div>
        )
    }

    return (
        <div className="img-upload-area" onClick={() => inputRef.current?.click()}>
            {loading
                ? <span className="img-upload-label">Обработка...</span>
                : <span className="img-upload-label">+ Загрузить фото</span>
            }
            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
    )
}

// ─── ShopNoteSheet ─────────────────────────────────────────────────
function ShopNoteSheet() {
    const [val, setVal] = useState('')
    const [loaded, setLoaded] = useState(false)
    const [open, setOpen] = useState(false)
    const [closing, setClosing] = useState(false)
    const tabDragStart = useRef(null)
    const sheetDragStart = useRef(null)
    const textareaRef = useRef(null)

    useEffect(() => {
        return onSnapshot(doc(db, 'meta', 'shopNote'), (snap) => {
            if (snap.exists()) setVal(snap.data().text || '')
            setLoaded(true)
        })
    }, [])

    const save = async (text) => {
        await setDoc(doc(db, 'meta', 'shopNote'), { text })
    }

    const openSheet = () => { setClosing(false); setOpen(true) }

    const closeSheet = () => {
        save(val)
        setClosing(true)
        setTimeout(() => { setOpen(false); setClosing(false) }, 220)
    }

    // Tab: swipe up to open
    const handleTabTouchStart = (e) => { tabDragStart.current = e.touches[0].clientY }
    const handleTabTouchMove = (e) => {
        if (tabDragStart.current === null) return
        if (tabDragStart.current - e.touches[0].clientY > 30) {
            tabDragStart.current = null
            openSheet()
        }
    }
    const handleTabTouchEnd = () => { tabDragStart.current = null }

    // Sheet header: swipe down to close
    const handleSheetTouchStart = (e) => { sheetDragStart.current = e.touches[0].clientY }
    const handleSheetTouchMove = (e) => {
        if (sheetDragStart.current === null) return
        if (e.touches[0].clientY - sheetDragStart.current > 60) {
            sheetDragStart.current = null
            closeSheet()
        }
    }
    const handleSheetTouchEnd = () => { sheetDragStart.current = null }

    useEffect(() => {
        if (open && !closing && textareaRef.current) {
            const t = setTimeout(() => textareaRef.current?.focus(), 220)
            return () => clearTimeout(t)
        }
    }, [open, closing])

    if (!loaded) return null

    const hasText = !!val.trim()

    return (
        <>
            <div
                className={`shop-note-tab ${hasText ? 'has-text' : ''}`}
                onClick={openSheet}
                onTouchStart={handleTabTouchStart}
                onTouchMove={handleTabTouchMove}
                onTouchEnd={handleTabTouchEnd}
            >
                <span className="shop-note-tab-arrow">▲</span>
            </div>

            {open && (
                <div className={`sheet-overlay${closing ? ' note-overlay-closing' : ''}`} onClick={closeSheet}>
                    <div className={`note-sheet${closing ? ' note-sheet-closing' : ''}`} onClick={e => e.stopPropagation()}>
                        <div
                            className="note-sheet-drag-top"
                            onTouchStart={handleSheetTouchStart}
                            onTouchMove={handleSheetTouchMove}
                            onTouchEnd={handleSheetTouchEnd}
                        >
                            <div className="sheet-handle" />
                            <div className="note-sheet-title">Комментарий к походу</div>
                        </div>
                        <textarea
                            ref={textareaRef}
                            className="note-sheet-textarea"
                            value={val}
                            onChange={e => setVal(e.target.value)}
                            placeholder="Бюджет, маршрут, особые пожелания..."
                        />
                        <div className="note-sheet-footer">
                            <button className="btn-primary" onClick={closeSheet}>Готово</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

// ─── ShopChecklistItem ────────────────────────────────────────────
function ShopChecklistItem({ item, types, stores, lastAddedId, editingCommentId, setEditingCommentId, onToggle, onRemove }) {
    const [sheet, setSheet] = useState(false)

    const sheetItems = [
        { icon: '✎', label: 'Комментарий', action: () => setEditingCommentId(item.id) },
        'divider',
        { icon: '✕', label: 'Убрать из списка', danger: true, action: onRemove },
    ]

    const handlers = useLongPress(() => setSheet(true), onToggle)

    return (
        <>
            {sheet && <BottomSheet title={item.name} items={sheetItems} onClose={() => setSheet(false)} />}
            <div className={`shop-checklist-item ${item.done ? 'done-item' : ''}`} {...handlers}>
                <div className="shop-checkbox">{item.done && '✓'}</div>
                <div className="shop-item-body">
                    <div className="shop-main-row">
                        <span className={`shop-item-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                        {(item.types || []).map(id => { const t = types.find(x => x.id === id); return t ? <span key={id} className="shop-tag">{t.name}</span> : null })}
                        {(item.stores || []).map(id => { const s = stores.find(x => x.id === id); return s ? <span key={id} className="shop-tag">{s.name}</span> : null })}
                    </div>
                    <CommentText item={item} editingId={editingCommentId} setEditingId={setEditingCommentId} />
                </div>
                <div className="shop-right">
                    <QtyInput item={item} autoFocus={item.id === lastAddedId} />
                    <CommentBtn item={item} editingId={editingCommentId} setEditingId={setEditingCommentId} />
                    <button className="icon-btn" style={{ opacity: 0.5 }} onClick={e => { e.stopPropagation(); onRemove() }}>✕</button>
                </div>
            </div>
        </>
    )
}

// ─── ChecklistItem ────────────────────────────────────────────────
function ChecklistItem({ item, types, stores, lastAddedId, editingCommentId, setEditingCommentId, onToggle, onRemove, onEditComment }) {
    const [sheet, setSheet] = useState(false)

    const sheetItems = [
        { icon: '✎', label: 'Комментарий', action: () => setEditingCommentId(item.id) },
        'divider',
        { icon: '✕', label: 'Убрать из списка', danger: true, action: onRemove },
    ]

    const handlers = useLongPress(() => setSheet(true), onToggle)

    return (
        <>
            {sheet && <BottomSheet title={item.name} items={sheetItems} onClose={() => setSheet(false)} />}
            <div className="checklist-item" {...handlers}>
                <div className={`cl-check ${item.done ? 'checked' : ''}`}>{item.done && '✓'}</div>
                <div className="cl-body">
                    <div className="cl-main-row">
                        <span className={`cl-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                        {(item.types || []).slice(0, 2).map(id => { const t = types.find(x => x.id === id); return t ? <span key={id} className="cl-tag">{t.name}</span> : null })}
                        {(item.stores || []).slice(0, 2).map(id => { const s = stores.find(x => x.id === id); return s ? <span key={id} className="cl-tag">{s.name}</span> : null })}
                    </div>
                    <CommentText item={item} editingId={editingCommentId} setEditingId={setEditingCommentId} />
                </div>
                <div className="cl-right">
                    <QtyInput item={item} autoFocus={item.id === lastAddedId} />
                    <CommentBtn item={item} editingId={editingCommentId} setEditingId={setEditingCommentId} />
                    <button className="cl-remove" onClick={e => { e.stopPropagation(); onRemove() }}>✕</button>
                </div>
            </div>
        </>
    )
}

// ─── App ───────────────────────────────────────────────────────────
export default function App() {
    const [products, setProducts] = useState([])
    const [checklist, setChecklist] = useState([])
    const [stores, setStores] = useState([])
    const [types, setTypes] = useState([])

    const [viewMode, setViewMode] = useState('catalog')
    const [showSettings, setShowSettings] = useState(false)
    const [modal, setModal] = useState(null)
    const [form, setForm] = useState({ name: '', stores: [], types: [], note: '', image: '', unit: '', unitCustom: '' })

    const [ctxMenu, setCtxMenu] = useState(null)
    const [sheet, setSheet] = useState(null)
    const [lastAddedId, setLastAddedId] = useState(null)
    const [editingCommentId, setEditingCommentId] = useState(null)

    useEffect(() => {
        if (lastAddedId) {
            const t = setTimeout(() => setLastAddedId(null), 300)
            return () => clearTimeout(t)
        }
    }, [lastAddedId])

    const [catActiveStores, setCatActiveStores] = useState([])
    const [catActiveTypes, setCatActiveTypes] = useState([])
    const [clActiveStores, setClActiveStores] = useState([])
    const [clActiveTypes, setClActiveTypes] = useState([])

    // ── Subscriptions ──
    useEffect(() => {
        return onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), snap =>
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    }, [])

    useEffect(() => {
        const q = query(collection(db, 'checklist'), orderBy('addedAt', 'desc'))
        let firstLoad = true
        return onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            setChecklist(data)
            if (firstLoad) { firstLoad = false; if (data.length > 0 && window.innerWidth <= 992) setViewMode('shop') }
        })
    }, [])

    useEffect(() => {
        return onSnapshot(query(collection(db, 'stores'), orderBy('createdAt', 'asc')), snap =>
            setStores(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    }, [])

    useEffect(() => {
        return onSnapshot(query(collection(db, 'types'), orderBy('createdAt', 'asc')), snap =>
            setTypes(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    }, [])

    // ── Auto-cleanup: remove done items older than 4h ──
    useEffect(() => {
        const cleanup = async () => {
            const cutoff = Date.now() - 4 * 60 * 60 * 1000
            const snap = await getDocs(collection(db, 'checklist'))
            const toDelete = snap.docs.filter(d => {
                const data = d.data()
                return data.done && data.addedAt && data.addedAt < cutoff
            })
            await Promise.all(toDelete.map(d => deleteDoc(doc(db, 'checklist', d.id))))
        }
        cleanup()
    }, [])

    // ── Filters ──
    const toggleFilter = (id, active, setActive) => {
        setActive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const applyFilters = (items, activeStores, activeTypes) => {
        return items.filter(item => {
            const itemStores = item.stores || []
            const itemTypes = item.types || []
            if (activeTypes.length > 0 && !activeTypes.some(t => itemTypes.includes(t))) return false
            if (activeStores.length > 0 && !activeStores.some(s => itemStores.includes(s))) return false
            return true
        })
    }

    const byName = (a, b) => a.name.localeCompare(b.name, 'ru')

    const filteredProducts = applyFilters(products, catActiveStores, catActiveTypes).sort(byName)
    const filteredChecklist = applyFilters(checklist, clActiveStores, clActiveTypes).sort(byName)

    // ── Actions ──
    const inChecklist = useCallback((id) => checklist.some(c => c.productId === id), [checklist])

    const toggleChecklist = useCallback(async (product) => {
        const existing = checklist.find(c => c.productId === product.id)
        if (existing) {
            await deleteDoc(doc(db, 'checklist', existing.id))
        } else {
            const ref = await addDoc(collection(db, 'checklist'), {
                productId: product.id,
                name: product.name,
                stores: product.stores || [],
                types: product.types || [],
                unit: product.unit || '',
                qty: '',
                done: false,
                addedAt: Date.now()
            })
            setLastAddedId(ref.id)
        }
    }, [checklist])

    const toggleDone = useCallback(async (item) => {
        await updateDoc(doc(db, 'checklist', item.id), { done: !item.done })
    }, [])

    const removeFromChecklist = useCallback(async (id) => {
        await deleteDoc(doc(db, 'checklist', id))
    }, [])

    const clearDone = useCallback(async () => {
        await Promise.all(checklist.filter(c => c.done).map(c => deleteDoc(doc(db, 'checklist', c.id))))
    }, [checklist])

    const deleteProduct = useCallback(async (id) => {
        await deleteDoc(doc(db, 'products', id))
        const inList = checklist.find(c => c.productId === id)
        if (inList) await deleteDoc(doc(db, 'checklist', inList.id))
    }, [checklist])

    const saveProduct = useCallback(async () => {
        if (!form.name.trim()) return
        const data = {
            name: form.name.trim(),
            stores: form.stores,
            types: form.types,
            note: form.note.trim(),
            image: form.image.trim(),
            unit: form.unit === 'своя' ? form.unitCustom.trim() : form.unit
        }
        if (modal.mode === 'add') {
            await addDoc(collection(db, 'products'), { ...data, createdAt: Date.now() })
        } else {
            await updateDoc(doc(db, 'products', modal.product.id), data)
            const inList = checklist.find(c => c.productId === modal.product.id)
            if (inList) await updateDoc(doc(db, 'checklist', inList.id), { name: data.name, stores: data.stores, types: data.types })
        }
        setModal(null)
    }, [form, modal, checklist])

    const openAdd = () => {
        setForm({ name: '', stores: [], types: [], note: '', image: '', unit: '', unitCustom: '' })
        setModal({ mode: 'add' })
    }
    const openEdit = (p) => {
        setForm({ name: p.name, stores: p.stores || [], types: p.types || [], note: p.note || '', image: p.image || '', unit: p.unit || '', unitCustom: p.unitCustom || '' })
        setModal({ mode: 'edit', product: p })
    }
    const openView = (p) => setModal({ mode: 'view', product: p })

    const toggleFormMulti = (field, id) => {
        setForm(f => ({ ...f, [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id] }))
    }

    const menuItems = useCallback((product) => [
        {
            icon: inChecklist(product.id) ? '✓' : '+',
            label: inChecklist(product.id) ? 'Убрать из списка' : 'Добавить в список',
            action: () => toggleChecklist(product)
        },
        { icon: 'ℹ', label: 'Подробнее', action: () => openView(product) },
        { icon: '✎', label: 'Редактировать', action: () => openEdit(product) },
        'divider',
        { icon: '✕', label: 'Удалить', danger: true, action: () => deleteProduct(product.id) },
    ], [inChecklist, toggleChecklist, deleteProduct])

    // ── Checklist column shared JSX ──
    const checklistItems = (filteredChecklist, lastAddedId) => filteredChecklist.map(item => (
        <ChecklistItem
            key={item.id}
            item={item}
            types={types}
            stores={stores}
            lastAddedId={lastAddedId}
            editingCommentId={editingCommentId}
            setEditingCommentId={setEditingCommentId}
            onToggle={() => toggleDone(item)}
            onRemove={() => removeFromChecklist(item.id)}
            onEditComment={() => setEditingCommentId(item.id)}
        />
    ))

    return (
        <>
            {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={menuItems(ctxMenu.product)} onClose={() => setCtxMenu(null)} />}
            {sheet && <BottomSheet title={sheet.product.name} items={menuItems(sheet.product)} onClose={() => setSheet(null)} />}
            {showSettings && <SettingsPanel stores={stores} types={types} onClose={() => setShowSettings(false)} />}

            <div className="app">
                <div className="header">
                    <h1>
                        <img src="/favicon.svg" alt="Z" className="logo-icon"/>
                        akup
                    </h1>
                    <span className="header-sub">общий список</span>
                    <div className="header-right">
                        <button className={`toggle-btn mobile-only ${viewMode === 'catalog' ? 'active' : ''}`}
                                onClick={() => setViewMode('catalog')}>☰ Каталог
                        </button>
                        <button className={`toggle-btn mobile-only ${viewMode === 'shop' ? 'active' : ''}`}
                                onClick={() => setViewMode('shop')}>🛒 Магазин
                        </button>
                        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Настройки">⚙</button>
                    </div>
                </div>

                <div className={`columns mobile-${viewMode}`}>
                    {/* CATALOG */}
                    <div className="column catalog-column">
                        <div className="column-header">
                            <span className="column-title">Каталог</span>
                            <span className="column-count">{filteredProducts.length}</span>
                        </div>
                        <FilterRows
                            stores={stores} types={types}
                            activeStores={catActiveStores} activeTypes={catActiveTypes}
                            onToggleStore={id => toggleFilter(id, catActiveStores, setCatActiveStores)}
                            onToggleType={id => toggleFilter(id, catActiveTypes, setCatActiveTypes)}
                        />
                        <div className="items-list">
                            {filteredProducts.length === 0 && <div className="empty">{products.length === 0 ? 'Пусто' : 'Ничего не найдено'}</div>}
                            {filteredProducts.map(product => (
                                <CatalogItem
                                    key={product.id}
                                    product={product}
                                    inList={inChecklist(product.id)}
                                    stores={stores}
                                    types={types}
                                    onToggle={() => toggleChecklist(product)}
                                    onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, product }) }}
                                    onLongPress={() => setSheet({ product })}
                                />
                            ))}
                        </div>
                        <div className="add-form">
                            <button className="add-btn" onClick={openAdd}>+ Добавить продукт</button>
                        </div>
                    </div>

                    {/* CHECKLIST */}
                    <div className="column checklist-column">
                        <div className="column-header">
                            <span className="column-title">Список покупок</span>
                            <div className="column-header-right">
                                <span className="column-count">{checklist.filter(c => !c.done).length} / {checklist.length}</span>
                                {checklist.some(c => c.done) && <button className="chip" onClick={clearDone}>Очистить</button>}
                            </div>
                        </div>
                        <FilterRows
                            stores={stores} types={types}
                            activeStores={clActiveStores} activeTypes={clActiveTypes}
                            onToggleStore={id => toggleFilter(id, clActiveStores, setClActiveStores)}
                            onToggleType={id => toggleFilter(id, clActiveTypes, setClActiveTypes)}
                            checklist={checklist}
                        />
                        <div className="items-list">
                            {filteredChecklist.length === 0 && <div className="empty">{checklist.length === 0 ? 'Нажмите на продукт чтобы добавить' : 'Ничего не найдено'}</div>}
                            {checklistItems(filteredChecklist, lastAddedId)}
                        </div>
                        <ShopNoteSheet />
                    </div>
                </div>
            </div>

            {/* MODAL */}
            {modal && (
                <div className="overlay" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">
                                {modal.mode === 'view' ? modal.product.name : modal.mode === 'add' ? 'Новый продукт' : 'Редактировать'}
                            </span>
                            <button className="icon-btn" onClick={() => setModal(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {modal.mode === 'view' ? (
                                <>
                                    {modal.product.image
                                        ? (
                                            <div className="modal-img-wrap">
                                                <div className="modal-img-blur" style={{ backgroundImage: `url(${modal.product.image})` }} />
                                                <div className="modal-img-main">
                                                    <img src={modal.product.image} alt={modal.product.name} />
                                                </div>
                                            </div>
                                        )
                                        : <div className="modal-img-placeholder">Нет изображения</div>
                                    }
                                    {(modal.product.types?.length > 0 || modal.product.stores?.length > 0) && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {(modal.product.types || []).map(id => { const t = types.find(x => x.id === id); return t ? <span key={id} className="item-tag">{t.name}</span> : null })}
                                            {(modal.product.stores || []).map(id => { const s = stores.find(x => x.id === id); return s ? <span key={id} className="item-tag">{s.name}</span> : null })}
                                        </div>
                                    )}
                                    {modal.product.note
                                        ? <p className="modal-note">{modal.product.note}</p>
                                        : <p className="modal-note" style={{ fontStyle: 'italic' }}>Нет заметки</p>
                                    }
                                </>
                            ) : (
                                <>
                                    <div>
                                        <div className="field-label">Название</div>
                                        <input className="field-input" value={form.name}
                                               onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                               placeholder="Молоко, хлеб..." autoFocus
                                               onKeyDown={e => e.key === 'Enter' && saveProduct()} />
                                    </div>
                                    {types.length > 0 && (
                                        <div>
                                            <div className="field-label">Тип товара</div>
                                            <div className="multi-select">
                                                {types.map(t => (
                                                    <button key={t.id} className={`ms-chip ${form.types.includes(t.id) ? 'selected' : ''}`}
                                                            onClick={() => toggleFormMulti('types', t.id)}>{t.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {stores.length > 0 && (
                                        <div>
                                            <div className="field-label">Магазины</div>
                                            <div className="multi-select">
                                                {stores.map(s => (
                                                    <button key={s.id} className={`ms-chip ${form.stores.includes(s.id) ? 'selected' : ''}`}
                                                            onClick={() => toggleFormMulti('stores', s.id)}>{s.name}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="field-label">Единица измерения</div>
                                        <div className="unit-row">
                                            <select className="unit-select" value={form.unit}
                                                    onChange={e => setForm(f => ({ ...f, unit: e.target.value, unitCustom: '' }))}>
                                                <option value="">— не указана</option>
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                            {form.unit === 'своя' && (
                                                <input className="unit-custom-input" value={form.unitCustom}
                                                       onChange={e => setForm(f => ({ ...f, unitCustom: e.target.value }))}
                                                       placeholder="напр. пачка" autoFocus />
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="field-label">Фото</div>
                                        <ImageUpload
                                            currentImage={form.image}
                                            onUploaded={url => setForm(f => ({ ...f, image: url }))}
                                            onRemoved={() => setForm(f => ({ ...f, image: '' }))}
                                        />
                                    </div>
                                    <div>
                                        <div className="field-label">Заметка</div>
                                        <textarea className="field-input" value={form.note}
                                                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                                  placeholder="Бренд, детали..." />
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            {modal.mode === 'view' ? (
                                <>
                                    <button className="btn-danger" onClick={() => { deleteProduct(modal.product.id); setModal(null) }}>Удалить</button>
                                    <button className="btn-secondary" onClick={() => openEdit(modal.product)}>Редактировать</button>
                                    <button className="btn-primary" onClick={() => { toggleChecklist(modal.product); setModal(null) }}>
                                        {inChecklist(modal.product.id) ? 'Убрать из списка' : '+ В список'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button className="btn-secondary" onClick={() => setModal(null)}>Отмена</button>
                                    <button className="btn-primary" onClick={saveProduct}>Сохранить</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}