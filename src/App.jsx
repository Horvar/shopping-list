import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { db } from './firebase'
import {
    collection, addDoc, deleteDoc, updateDoc,
    doc, onSnapshot, query, orderBy, setDoc, getDocs
} from 'firebase/firestore'
import { THEMES, TRANSLATIONS, LANGUAGE_NAMES } from './i18n'
import { IconClose, IconCheck, IconEdit, IconInfo, IconMore, IconSearch, IconSettings, IconNote, IconMenu, IconCart, IconComment, IconDelete, IconRemove, IconAdd, IconOneTime, IconCircleEmpty, IconCircleArrow, IconCircleCheck, IconImage, IconChevronDown } from './icons'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'уп', 'своя']

// ─── User preferences ──────────────────────────────────────────────
function usePreferences() {
    const [lang, setLangState] = useState(() => localStorage.getItem('zakup_lang') || 'ru')
    const [theme, setThemeState] = useState(() => localStorage.getItem('zakup_theme') || 'dark')

    const setLang = (l) => { setLangState(l); localStorage.setItem('zakup_lang', l) }
    const setTheme = (t) => { setThemeState(t); localStorage.setItem('zakup_theme', t) }

    useEffect(() => {
        const vars = THEMES[theme]
        Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
    }, [theme])

    const t = TRANSLATIONS[lang] || TRANSLATIONS.ru
    return { lang, setLang, theme, setTheme, t }
}

// ─── Hooks ─────────────────────────────────────────────────────────
function useVisualViewport() {
    const [vp, setVp] = useState(() => ({
        height: window.visualViewport?.height ?? window.innerHeight,
        offsetTop: window.visualViewport?.offsetTop ?? 0,
    }))
    useEffect(() => {
        const vv = window.visualViewport
        if (!vv) return
        const update = () => setVp({ height: vv.height, offsetTop: vv.offsetTop })
        vv.addEventListener('resize', update)
        vv.addEventListener('scroll', update)
        return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
    }, [])
    return vp
}

function useDragScroll() {
    const ref = useRef(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        let isDown = false, startX, scrollLeft
        const onDown = (e) => { isDown = true; el.classList.add('dragging'); startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft }
        const onUp = () => { isDown = false; el.classList.remove('dragging') }
        const onMove = (e) => { if (!isDown) return; e.preventDefault(); el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX) }
        el.addEventListener('mousedown', onDown)
        el.addEventListener('mouseleave', onUp)
        el.addEventListener('mouseup', onUp)
        el.addEventListener('mousemove', onMove)
        return () => { el.removeEventListener('mousedown', onDown); el.removeEventListener('mouseleave', onUp); el.removeEventListener('mouseup', onUp); el.removeEventListener('mousemove', onMove) }
    }, [])
    return ref
}

// ─── Modal (универсальный центрированный модальный) ────────────────
function Modal({ title, onClose, footer, children }) {
    const mouseDownTarget = useRef(null)
    return (
        <div
            className="overlay"
            onMouseDown={e => { mouseDownTarget.current = e.target }}
            onMouseUp={e => { if (mouseDownTarget.current === e.currentTarget && e.target === e.currentTarget) onClose() }}
        >
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span className="modal-title">{title}</span>
                    <button className="icon-btn" onClick={onClose}><IconClose /></button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </div>
    )
}

// ─── Drawer (универсальная боковая панель) ─────────────────────────
function Drawer({ isOpen, onClose, title, children, zIndex = 100, panelStyle }) {
    return (
        <>
            {isOpen && <div className="drawer-overlay" style={{ zIndex: zIndex - 1 }} onClick={onClose} />}
            <div className={`drawer-panel${isOpen ? ' is-open' : ''}`} style={{ zIndex, ...panelStyle }}>
                <div className="drawer-header">
                    <span className="drawer-title">{title}</span>
                    <button className="icon-btn" onClick={onClose}><IconClose /></button>
                </div>
                {children}
            </div>
        </>
    )
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
    }, [x, y])

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={onClose} />
            <div ref={menuRef} className="ctx-menu" style={{ left: pos.x, top: pos.y }}>
                {items.map((item, i) => item === 'divider'
                    ? <div key={i} className="ctx-divider" />
                    : <div key={i} className={`ctx-item ${item.danger ? 'danger' : ''}`} onClick={() => { item.action(); onClose() }}>
                        <span className="ctx-icon">{item.icon}</span>{item.label}
                    </div>
                )}
            </div>
        </>
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

// ─── ItemMenu ──────────────────────────────────────────────────────
function ItemMenu({ title, items }) {
    const [menu, setMenu] = useState(null)

    const handleClick = useCallback((e) => {
        if (window.innerWidth <= 992) {
            setMenu({ mobile: true })
        } else {
            const rect = e.currentTarget.getBoundingClientRect()
            setMenu({ x: rect.left, y: rect.bottom + 4 })
        }
    }, [])

    const close = useCallback(() => setMenu(null), [])

    return (
        <>
            <button className="item-menu-btn" onClick={handleClick}><IconMore /></button>
            {menu?.mobile && <BottomSheet title={title} items={items} onClose={close} />}
            {menu && !menu.mobile && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={close} />}
        </>
    )
}

// ─── CatalogItem ───────────────────────────────────────────────────
function CatalogItem({ product, inList, stores, types, onToggle, onView, onEdit, onDelete, t }) {
    const productStoreIds = product.stores || []
    const variantStoreIds = [...new Set((product.variants || []).flatMap(v => normalizeVariant(v).stores || []))]
    const effectiveStoreIds = variantStoreIds.length > 0 ? variantStoreIds : productStoreIds
    const typeTags = (product.types || []).map(id => types.find(x => x.id === id)?.name).filter(Boolean)
    const storeTags = effectiveStoreIds.map(id => stores.find(x => x.id === id)?.name).filter(Boolean)
    const tags = [...typeTags, ...storeTags]
    const menuItems = [
        { icon: <IconInfo />, label: t.details, action: onView },
        { icon: <IconEdit />, label: t.edit, action: onEdit },
        'divider',
        { icon: <IconDelete />, label: t.delete, danger: true, action: onDelete },
    ]

    return (
        <div className={`item ${inList ? 'in-list' : ''}`}>
            <div className="item-main" onClick={onToggle}>
                <div className="item-check">{inList ? <IconCircleArrow /> : <IconCircleEmpty />}</div>
                <span className="item-name">{product.name}</span>
                {tags.length > 0 && (
                    <div className="item-tags">
                        {tags.slice(0, 4).map((tag, i) => (
                            <span key={i} className="item-tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
            <ItemMenu title={product.name} items={menuItems} />
        </div>
    )
}

// ─── Settings Panel ────────────────────────────────────────────────
function SettingsPanel({ isOpen, stores, types, onClose, lang, setLang, theme, setTheme, t }) {
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
        <Drawer isOpen={isOpen} onClose={onClose} title={t.settings} zIndex={151}>
            <div className="drawer-body">
                {/* Appearance */}
                <div>
                    <div className="settings-section-title">{t.appearance}</div>
                    <div className="pref-row">
                        <span className="pref-label">{t.theme}</span>
                        <div className="pref-options">
                            <button className={`pref-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>{t.theme_dark}</button>
                            <button className={`pref-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>{t.theme_light}</button>
                        </div>
                    </div>
                    <div className="pref-row">
                        <span className="pref-label">{t.language}</span>
                        <div className="pref-options">
                            {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                                <button key={code} className={`pref-btn ${lang === code ? 'active' : ''}`} onClick={() => setLang(code)}>{name}</button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stores */}
                <div>
                    <div className="settings-section-title">{t.stores}</div>
                    <div className="tag-list">
                        {stores.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--muted2)' }}>{t.no_stores}</div>}
                        {[...stores].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(s => (
                            <div key={s.id} className="tag-row">
                                <span className="tag-row-name">{s.name}</span>
                                <button className="tag-row-icon" onClick={() => delStore(s.id)}><IconClose /></button>
                            </div>
                        ))}
                    </div>
                    <div className="tag-add-row">
                        <input className="tag-input" value={newStore} placeholder={t.store_placeholder}
                               onChange={e => setNewStore(e.target.value)}
                               onKeyDown={e => e.key === 'Enter' && addStore()} />
                        <button className="tag-add-btn" onClick={addStore}><IconAdd />{t.add}</button>
                    </div>
                </div>

                {/* Types */}
                <div>
                    <div className="settings-section-title">{t.types}</div>
                    <div className="tag-list">
                        {types.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--muted2)' }}>{t.no_types}</div>}
                        {[...types].sort((a, b) => a.name.localeCompare(b.name, 'ru')).map(type => (
                            <div key={type.id} className="tag-row">
                                <span className="tag-row-name">{type.name}</span>
                                <button className="tag-row-icon" onClick={() => delType(type.id)}><IconClose /></button>
                            </div>
                        ))}
                    </div>
                    <div className="tag-add-row">
                        <input className="tag-input" value={newType} placeholder={t.type_placeholder}
                               onChange={e => setNewType(e.target.value)}
                               onKeyDown={e => e.key === 'Enter' && addType()} />
                        <button className="tag-add-btn" onClick={addType}><IconAdd />{t.add}</button>
                    </div>
                </div>
            </div>
        </Drawer>
    )
}

// ─── Filter rows ───────────────────────────────────────────────────
function FilterRows({ stores, types, activeStores, activeTypes, onToggleStore, onToggleType, checklist, sortMode, t }) {
    if (sortMode !== 'type' && sortMode !== 'store') return null
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
            {sortMode === 'type' && sortedTypes.length > 0 && (
                <div className="filter-row">
                    <span className="filter-row-label">{t.filter_type}</span>
                    <div className="filter-chips" ref={typeChipsRef}>
                        {sortedTypes.map(type => {
                            const count = checklist ? countByType[type.id] : null
                            return (
                                <button key={type.id} className={`chip ${activeTypes.includes(type.id) ? 'active' : ''}`} onClick={() => onToggleType(type.id)}>
                                    {type.name}{count ? <span className="chip-count">{count}</span> : null}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
            {sortMode === 'store' && sortedStores.length > 0 && (
                <div className="filter-row">
                    <span className="filter-row-label">{t.filter_store}</span>
                    <div className="filter-chips" ref={storeChipsRef}>
                        {sortedStores.map(store => {
                            const count = checklist ? countByStore[store.id] : null
                            return (
                                <button key={store.id} className={`chip ${activeStores.includes(store.id) ? 'active' : ''}`} onClick={() => onToggleStore(store.id)}>
                                    {store.name}{count ? <span className="chip-count">{count}</span> : null}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── SortDropdown ─────────────────────────────────────────────────
function SortDropdown({ value, onChange, options }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!open) return
        const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
        document.addEventListener('pointerdown', handler)
        return () => document.removeEventListener('pointerdown', handler)
    }, [open])

    const current = options.find(o => o.value === value)

    return (
        <div className="sort-dropdown" ref={ref}>
            <button className={`sort-dropdown-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
                <span>{current?.label}</span>
                <span className="sort-dropdown-chevron"><IconChevronDown /></span>
            </button>
            {open && (
                <div className="sort-dropdown-menu">
                    {options.map(opt => (
                        <button key={opt.value}
                                className={`sort-dropdown-item${value === opt.value ? ' active' : ''}`}
                                onClick={() => { onChange(opt.value); setOpen(false) }}>
                            <span className="sort-dropdown-check">{value === opt.value ? <IconCheck /> : null}</span>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── CommentText ──────────────────────────────────────────────────
function CommentText({ item, editingId, setEditingId, t }) {
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
            <input className="cl-comment-input-below" value={val}
                   onChange={e => setVal(e.target.value)} onBlur={save}
                   onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(item.comment || ''); setEditingId(null) } }}
                   onClick={e => e.stopPropagation()} autoFocus placeholder={t.comment} />
        )
    }

    if (!item.comment) return null
    return <div className="cl-comment-below" onClick={e => { e.stopPropagation(); setEditingId(item.id) }}>{item.comment}</div>
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
            <input className="qty-input" value={val}
                   onChange={e => setVal(e.target.value)} onBlur={save}
                   onKeyDown={e => { if (e.key === 'Enter') { save(); e.target.blur() } }}
                   autoFocus={autoFocus} placeholder="—" />
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
            if (width > height) { if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize } }
            else { if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize } }
            const canvas = document.createElement('canvas')
            canvas.width = width; canvas.height = height
            canvas.getContext('2d').drawImage(img, 0, 0, width, height)
            resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.src = url
    })
}

function ImageUpload({ currentImage, onUploaded, onRemoved, t }) {
    const [loading, setLoading] = useState(false)
    const inputRef = useRef(null)

    const handleFile = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setLoading(true)
        try { onUploaded(await compressImage(file)) }
        catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    const handleRemove = (e) => { e.stopPropagation(); onRemoved(); if (inputRef.current) inputRef.current.value = '' }

    if (currentImage) {
        return (
            <div className="img-upload-preview">
                <img src={currentImage} alt="" className="img-preview" />
                <button className="img-remove-btn" onClick={handleRemove}>{t.delete_photo}</button>
            </div>
        )
    }

    return (
        <div className="img-upload-area" onClick={() => inputRef.current?.click()}>
            <span className="img-upload-label">{loading ? t.processing : <><IconAdd />{t.upload_photo}</>}</span>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
    )
}

// ─── ShopNoteModal ─────────────────────────────────────────────────
function ShopNoteModal({ t }) {
    const [val, setVal] = useState('')
    const [loaded, setLoaded] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const vp = useVisualViewport()

    useEffect(() => {
        return onSnapshot(doc(db, 'meta', 'shopNote'), snap => {
            if (snap.exists()) setVal(snap.data().text || '')
            setLoaded(true)
        })
    }, [])

    const save = async (text) => { await setDoc(doc(db, 'meta', 'shopNote'), { text }) }
    const closeAndSave = useCallback(() => { save(val); setIsOpen(false) }, [val])

    if (!loaded) return null

    const hasText = !!val.trim()
    const panelStyle = { top: vp.offsetTop, height: vp.height, bottom: 'auto' }
    const fabStyle = { top: vp.offsetTop + vp.height - 58, bottom: 'auto' }

    return (
        <>
            <button
                className={`note-fab${hasText ? ' has-text' : ''}${isOpen ? ' is-open' : ''}`}
                style={fabStyle}
                onClick={() => isOpen ? closeAndSave() : setIsOpen(true)}
            >
                {isOpen ? <IconCheck /> : <IconNote />}
            </button>
            <Drawer isOpen={isOpen} onClose={closeAndSave} title={t.shop_note_title} zIndex={100} panelStyle={panelStyle}>
                <textarea
                    className="note-modal-textarea"
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    placeholder={t.shop_note_placeholder}
                />
            </Drawer>
        </>
    )
}

// ─── ChecklistItem ────────────────────────────────────────────────
function ChecklistItem({ item, types, stores, lastAddedId, editingCommentId, setEditingCommentId, onToggle, onRemove, onView, t }) {
    const menuItems = [
        ...(!item.oneTime ? [{ icon: <IconInfo />, label: t.details, action: onView }] : []),
        { icon: <IconComment />, label: t.note, action: () => setEditingCommentId(item.id) },
        'divider',
        { icon: <IconRemove />, label: t.remove, danger: true, action: onRemove },
    ]

    return (
        <div className="checklist-item">
            <div className="cl-toggle" onClick={onToggle}>
                <div className={`cl-check ${item.done ? 'checked' : ''}`}>{item.done ? <IconCircleCheck /> : <IconCircleEmpty />}</div>
                <div className="cl-body">
                    <div className="cl-main-row">
                        <span className={`cl-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                        {item.variant && <span className="cl-variant-tag">{item.variant}</span>}
                        {item.oneTime && <span className="cl-tag onetime-tag"><IconOneTime /></span>}
                        {(item.types || []).slice(0, 2).map(id => { const tp = types.find(x => x.id === id); return tp ? <span key={id} className="cl-tag">{tp.name}</span> : null })}
                        {(item.stores || []).slice(0, 2).map(id => { const st = stores.find(x => x.id === id); return st ? <span key={id} className="cl-tag">{st.name}</span> : null })}
                    </div>
                    <CommentText item={item} editingId={editingCommentId} setEditingId={setEditingCommentId} t={t} />
                </div>
            </div>
            <div className="cl-right">
                <QtyInput item={item} autoFocus={item.id === lastAddedId} />
                <ItemMenu title={item.name} items={menuItems} />
            </div>
        </div>
    )
}

// ─── ProductModal ─────────────────────────────────────────────────
function ProductModal({ modal, form, setForm, stores, types, onClose, onSave, onDelete, onEdit, onToggleChecklist, onRemoveFromChecklist, inChecklist, t }) {
    const [variantInput, setVariantInput] = useState('')
    const toggleFormMulti = (field, id) => {
        setForm(f => ({ ...f, [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id] }))
    }
    const addVariant = () => {
        if (!variantInput.trim()) return
        setForm(f => ({ ...f, variants: [...(f.variants || []), { name: variantInput.trim(), image: '', stores: [], note: '' }] }))
        setVariantInput('')
    }
    const removeVariant = (i) => setForm(f => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))
    const updateVariantImage = (i, image) => setForm(f => ({ ...f, variants: f.variants.map((v, j) => j === i ? { ...v, image } : v) }))
    const updateVariantNote = (i, note) => setForm(f => ({ ...f, variants: f.variants.map((v, j) => j === i ? { ...v, note } : v) }))
    const toggleVariantStore = (i, storeId) => setForm(f => ({
        ...f,
        variants: f.variants.map((v, j) => j !== i ? v : {
            ...v,
            stores: (v.stores || []).includes(storeId) ? v.stores.filter(s => s !== storeId) : [...(v.stores || []), storeId]
        })
    }))
    const [variantMode, setVariantMode] = useState((form.variants || []).length > 0)
    const [selectedVariant, setSelectedVariant] = useState(() => {
        if (modal.mode !== 'view' || !modal.product.variants?.length) return null
        if (modal.variantName) return normalizeVariant(modal.product.variants.find(v => normalizeVariant(v).name === modal.variantName) || modal.product.variants[0])
        return normalizeVariant(modal.product.variants[0])
    })
    const switchToSimple = () => { setForm(f => ({ ...f, variants: [] })); setVariantMode(false) }
    const switchToVariant = () => { setForm(f => ({ ...f, stores: [] })); setVariantMode(true) }

    const title = modal.mode === 'view'
        ? modal.variantName
            ? <>{modal.product.name} <span className="modal-title-variant">| {modal.variantName}</span></>
            : modal.product.name
        : modal.mode === 'add' ? t.new_product : t.edit

    const footer = modal.mode === 'view' ? (
        modal.fromChecklist ? (
            <>
                <button className="btn-danger" onClick={() => { onRemoveFromChecklist(modal.checklistItemId); onClose() }}>{t.remove}</button>
                <button className="btn-secondary" onClick={() => onEdit(modal.product)}>{t.edit}</button>
            </>
        ) : (
            <>
                <button className="btn-danger" onClick={() => { onDelete(modal.product.id); onClose() }}>{t.delete}</button>
                <button className="btn-secondary" onClick={() => onEdit(modal.product)}>{t.edit}</button>
                <button className="btn-primary" onClick={() => { onToggleChecklist(modal.product); onClose() }}>
                    {(modal.product.variants?.length > 0) ? t.add_to_list : (inChecklist(modal.product.id) ? t.remove_from_list : t.add_to_list)}
                </button>
            </>
        )
    ) : (
        <>
            <button className="btn-secondary" onClick={onClose}>{t.cancel}</button>
            <button className="btn-primary" onClick={onSave}>{t.save}</button>
        </>
    )

    return (
        <Modal title={title} onClose={onClose} footer={footer}>
            {modal.mode === 'view' ? (
                <>
                    {modal.product.variants?.length > 0 && !modal.fromChecklist && (
                        <div className="variant-tabs">
                            {modal.product.variants.map(normalizeVariant).map((v, i) => (
                                <button key={i}
                                    className={`variant-tab ${selectedVariant?.name === v.name ? 'active' : ''}`}
                                    onClick={() => setSelectedVariant(v)}>
                                    {v.image && <img src={v.image} className="variant-tab-thumb" alt="" />}
                                    {v.name}
                                </button>
                            ))}
                        </div>
                    )}
                    {(() => {
                        const img = selectedVariant?.image || modal.product.image
                        return img ? (
                            <div className="modal-img-wrap">
                                <div className="modal-img-blur" style={{ backgroundImage: `url(${img})` }} />
                                <div className="modal-img-main"><img src={img} alt={modal.product.name} /></div>
                            </div>
                        ) : <div className="modal-img-placeholder">{t.no_image}</div>
                    })()}
                    {(() => {
                        const variantStoreIds = selectedVariant?.stores?.length > 0 ? selectedVariant.stores : null
                        const storeIds = variantStoreIds || modal.product.stores || []
                        const typeIds = modal.product.types || []
                        if (!typeIds.length && !storeIds.length) return null
                        return (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {typeIds.map(id => { const tp = types.find(x => x.id === id); return tp ? <span key={id} className="item-tag">{tp.name}</span> : null })}
                                {storeIds.map(id => { const st = stores.find(x => x.id === id); return st ? <span key={id} className="item-tag">{st.name}</span> : null })}
                            </div>
                        )
                    })()}
                    {(() => {
                        const note = selectedVariant ? (selectedVariant.note || '') : modal.product.note
                        return note
                            ? <p className="modal-note">{note}</p>
                            : <p className="modal-note" style={{ fontStyle: 'italic' }}>{t.no_note}</p>
                    })()}
                </>
            ) : (
                <>
                    <div>
                        <div className="field-label">{t.name}</div>
                        <input className="field-input" value={form.name}
                               onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                               placeholder={t.name_placeholder} autoFocus
                               onKeyDown={e => e.key === 'Enter' && onSave()} />
                    </div>
                    <div className="pref-options" style={{ alignSelf: 'flex-start' }}>
                        <button className={`pref-btn ${!variantMode ? 'active' : ''}`} onClick={switchToSimple}>{t.mode_simple}</button>
                        <button className={`pref-btn ${variantMode ? 'active' : ''}`} onClick={switchToVariant}>{t.mode_variants}</button>
                    </div>
                    {variantMode ? (<>
                        <div>
                            <div className="field-label">{t.variants_label}</div>
                            {(form.variants || []).length > 0 && (
                                <div className="variant-list">
                                    {form.variants.map((v, i) => (
                                        <div key={i} className="variant-edit-row">
                                            <VariantImageUpload
                                                image={v.image || ''}
                                                onUploaded={(img) => updateVariantImage(i, img)}
                                                onRemoved={() => updateVariantImage(i, '')}
                                            />
                                            <div className="variant-edit-info">
                                                <span className="variant-edit-name">{v.name}</span>
                                                {stores.length > 0 && (
                                                    <div className="variant-stores">
                                                        {stores.map(st => (
                                                            <button key={st.id}
                                                                className={`ms-chip ms-chip--xs ${(v.stores || []).includes(st.id) ? 'selected' : ''}`}
                                                                onClick={() => toggleVariantStore(i, st.id)}>
                                                                {st.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <input className="variant-note-input"
                                                    value={v.note || ''}
                                                    onChange={e => updateVariantNote(i, e.target.value)}
                                                    placeholder={t.note_placeholder} />
                                            </div>
                                            <button className="tag-row-icon" onClick={() => removeVariant(i)}><IconClose /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="tag-add-row">
                                <input className="tag-input" value={variantInput} placeholder={t.variant_placeholder}
                                       onChange={e => setVariantInput(e.target.value)}
                                       onKeyDown={e => e.key === 'Enter' && addVariant()} />
                                <button className="tag-add-btn" onClick={addVariant}><IconAdd />{t.add}</button>
                            </div>
                        </div>
                        {types.length > 0 && (
                            <div>
                                <div className="field-label">{t.product_type}</div>
                                <div className="multi-select">
                                    {types.map(tp => (
                                        <button key={tp.id} className={`ms-chip ${form.types.includes(tp.id) ? 'selected' : ''}`}
                                                onClick={() => toggleFormMulti('types', tp.id)}>{tp.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>) : (<>
                        {types.length > 0 && (
                            <div>
                                <div className="field-label">{t.product_type}</div>
                                <div className="multi-select">
                                    {types.map(tp => (
                                        <button key={tp.id} className={`ms-chip ${form.types.includes(tp.id) ? 'selected' : ''}`}
                                                onClick={() => toggleFormMulti('types', tp.id)}>{tp.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {stores.length > 0 && (
                            <div>
                                <div className="field-label">{t.stores_label}</div>
                                <div className="multi-select">
                                    {stores.map(st => (
                                        <button key={st.id} className={`ms-chip ${form.stores.includes(st.id) ? 'selected' : ''}`}
                                                onClick={() => toggleFormMulti('stores', st.id)}>{st.name}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>)}
                    <div>
                        <div className="field-label">{t.photo}</div>
                        <ImageUpload currentImage={form.image}
                                     onUploaded={url => setForm(f => ({ ...f, image: url }))}
                                     onRemoved={() => setForm(f => ({ ...f, image: '' }))} t={t} />
                    </div>
                    <div>
                        <div className="field-label">{t.note}</div>
                        <textarea className="field-input" value={form.note}
                                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                  placeholder={t.note_placeholder} />
                    </div>
                </>
            )}
        </Modal>
    )
}

// ─── Helpers ──────────────────────────────────────────────────────
const normalizeVariant = (v) => typeof v === 'string' ? { name: v, image: '', stores: [], note: '' } : { stores: [], note: '', ...v }

// ─── VariantImageUpload ────────────────────────────────────────────
function VariantImageUpload({ image, onUploaded, onRemoved }) {
    const [loading, setLoading] = useState(false)
    const inputRef = useRef(null)

    const handleFile = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        setLoading(true)
        try { onUploaded(await compressImage(file)) }
        catch (err) { console.error(err) }
        finally { setLoading(false); if (inputRef.current) inputRef.current.value = '' }
    }

    return (
        <div className="variant-img-btn">
            <div className="variant-img-area" onClick={() => inputRef.current?.click()}>
                {image
                    ? <img src={image} className="variant-img-preview" alt="" />
                    : <span className="variant-img-placeholder">{loading ? '…' : <IconAdd />}</span>
                }
            </div>
            {image && <button className="variant-img-remove" onClick={e => { e.stopPropagation(); onRemoved() }}><IconClose /></button>}
            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </div>
    )
}

// ─── VariantPickerModal ────────────────────────────────────────────
function VariantPickerModal({ product, onAdd, onClose, t }) {
    const [custom, setCustom] = useState('')
    const variants = (product.variants || []).map(normalizeVariant)

    const handleAdd = (name) => { onAdd(name); setCustom('') }

    const footer = (
        <button className="btn-secondary" style={{ width: '100%' }} onClick={() => handleAdd('')}>{t.no_variant}</button>
    )

    return (
        <Modal title={product.name} onClose={onClose} footer={footer}>
            <div className="variant-picker-list">
                {variants.map((v, i) => (
                    <button key={i} className="variant-picker-item" onClick={() => handleAdd(v.name)}>
                        <div className="variant-picker-thumb-wrap">
                            {v.image
                                ? <img src={v.image} className="variant-picker-thumb" alt="" />
                                : <span className="variant-picker-thumb-placeholder"><IconImage /></span>
                            }
                        </div>
                        <span className="variant-picker-name">{v.name}</span>
                    </button>
                ))}
            </div>
            <div className="tag-add-row">
                <input
                    className="tag-input"
                    value={custom}
                    placeholder={t.variant_placeholder}
                    onChange={e => setCustom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) handleAdd(custom.trim()) }}
                    autoFocus
                />
                <button className="tag-add-btn" onClick={() => { if (custom.trim()) handleAdd(custom.trim()) }}>
                    <IconAdd />{t.add}
                </button>
            </div>
        </Modal>
    )
}

// ─── App ───────────────────────────────────────────────────────────
export default function App() {
    const { lang, setLang, theme, setTheme, t } = usePreferences()

    const [products, setProducts] = useState([])
    const [checklist, setChecklist] = useState([])
    const [stores, setStores] = useState([])
    const [types, setTypes] = useState([])

    const [viewMode, setViewMode] = useState('catalog')
    const [showSettings, setShowSettings] = useState(false)
    const [modal, setModal] = useState(null)
    const [form, setForm] = useState({ name: '', stores: [], types: [], note: '', image: '', unit: '', unitCustom: '', variants: [] })
    const [variantPicker, setVariantPicker] = useState(null)

    const [lastAddedId, setLastAddedId] = useState(null)
    const [editingCommentId, setEditingCommentId] = useState(null)
    const [oneTimeInput, setOneTimeInput] = useState('')
    const [catSearch, setCatSearch] = useState('')
    const [catActiveStores, setCatActiveStores] = useState([])
    const [catActiveTypes, setCatActiveTypes] = useState([])
    const [clActiveStores, setClActiveStores] = useState([])
    const [clActiveTypes, setClActiveTypes] = useState([])
    const [catSort, setCatSort] = useState('alpha')
    const [clSort, setClSort] = useState('regularity')

    useEffect(() => {
        if (lastAddedId) {
            const timer = setTimeout(() => setLastAddedId(null), 300)
            return () => clearTimeout(timer)
        }
    }, [lastAddedId])

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

    useEffect(() => {
        const cleanup = async () => {
            const cutoff = Date.now() - 24 * 60 * 60 * 1000
            const snap = await getDocs(collection(db, 'checklist'))
            const toDelete = snap.docs.filter(d => { const data = d.data(); return data.done && data.addedAt && data.addedAt < cutoff })
            await Promise.all(toDelete.map(d => deleteDoc(doc(db, 'checklist', d.id))))
        }
        cleanup()
    }, [])

    const toggleFilter = (id, active, setActive) => {
        setActive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const applyFilters = (items, activeStores, activeTypes) => {
        return items.filter(item => {
            const itemStores = item.stores || []
            const itemTypes = item.types || []
            if (activeTypes.length > 0 && !activeTypes.some(tp => itemTypes.includes(tp))) return false
            if (activeStores.length > 0) {
                const directMatch = activeStores.some(s => itemStores.includes(s))
                const variantMatch = (item.variants || []).some(v =>
                    activeStores.some(s => (normalizeVariant(v).stores || []).includes(s))
                )
                if (!directMatch && !variantMatch) return false
            }
            return true
        })
    }

    const byName = (a, b) => a.name.localeCompare(b.name, 'ru')

    const getGroups = (items, sort, dimension, entities) => {
        if (sort === 'alpha') {
            return [{ key: 'all', label: null, items: [...items].sort(byName) }]
        }
        if (sort === 'regularity') {
            const regular = items.filter(i => !i.oneTime).sort(byName)
            const oneTime = items.filter(i => i.oneTime).sort(byName)
            const groups = []
            if (regular.length > 0) groups.push({ key: 'regular', label: null, items: regular })
            if (oneTime.length > 0) groups.push({ key: 'onetime', label: null, items: oneTime })
            return groups
        }
        const getPrimary = (item) => {
            const ids = item[dimension] || []
            if (!ids.length) return null
            const matched = ids.map(id => entities.find(e => e.id === id)).filter(Boolean)
            if (!matched.length) return null
            return matched.sort((a, b) => a.name.localeCompare(b.name, 'ru'))[0]
        }
        const groupMap = new Map()
        for (const item of items) {
            const entity = getPrimary(item)
            const key = entity ? entity.id : '__none__'
            const label = entity ? entity.name : null
            if (!groupMap.has(key)) groupMap.set(key, { label, items: [] })
            groupMap.get(key).items.push(item)
        }
        return [...groupMap.entries()]
            .map(([key, { label, items }]) => ({ key, label, items: [...items].sort(byName) }))
            .sort((a, b) => {
                if (a.key === '__none__') return 1
                if (b.key === '__none__') return -1
                return (a.label || '').localeCompare(b.label || '', 'ru')
            })
    }

    const catGroups = getGroups(
        applyFilters(products, catActiveStores, catActiveTypes)
            .filter(item => !catSearch || item.name.toLowerCase().includes(catSearch.toLowerCase())),
        catSort,
        catSort === 'type' ? 'types' : 'stores',
        catSort === 'type' ? types : stores
    )
    const clGroups = getGroups(
        applyFilters(checklist, clActiveStores, clActiveTypes),
        clSort,
        clSort === 'type' ? 'types' : 'stores',
        clSort === 'type' ? types : stores
    )
    const catTotalItems = catGroups.reduce((sum, g) => sum + g.items.length, 0)
    const clTotalItems = clGroups.reduce((sum, g) => sum + g.items.length, 0)

    const inChecklist = useCallback((id) => checklist.some(c => c.productId === id), [checklist])

    const addOneTimeItem = useCallback(async (name) => {
        if (!name.trim()) return
        const ref = await addDoc(collection(db, 'checklist'), {
            productId: null, oneTime: true, name: name.trim(),
            stores: [], types: [], unit: '', qty: '', done: false, addedAt: Date.now()
        })
        setLastAddedId(ref.id)
    }, [])

    const toggleChecklist = useCallback(async (product) => {
        if (product.variants?.length > 0) {
            setVariantPicker({ product })
            return
        }
        const existing = checklist.find(c => c.productId === product.id)
        if (existing) {
            await deleteDoc(doc(db, 'checklist', existing.id))
        } else {
            const ref = await addDoc(collection(db, 'checklist'), {
                productId: product.id, name: product.name,
                stores: product.stores || [], types: product.types || [],
                unit: product.unit || '', qty: '', done: false, addedAt: Date.now()
            })
            setLastAddedId(ref.id)
        }
    }, [checklist])

    const addToChecklistWithVariant = useCallback(async (product, variant) => {
        const variantObj = variant ? (product.variants || []).map(normalizeVariant).find(v => v.name === variant) : null
        const stores = variantObj?.stores?.length > 0 ? variantObj.stores : (product.stores || [])
        const ref = await addDoc(collection(db, 'checklist'), {
            productId: product.id, name: product.name,
            variant: variant || '',
            stores, types: product.types || [],
            unit: product.unit || '', qty: '', done: false, addedAt: Date.now()
        })
        setLastAddedId(ref.id)
        setVariantPicker(null)
    }, [])

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
            name: form.name.trim(), stores: form.stores, types: form.types,
            note: form.note.trim(), image: form.image.trim(),
            unit: form.unit === 'своя' ? form.unitCustom.trim() : form.unit,
            variants: form.variants || []
        }
        if (modal.mode === 'add') {
            await addDoc(collection(db, 'products'), { ...data, createdAt: Date.now() })
        } else {
            await updateDoc(doc(db, 'products', modal.product.id), data)
            const inList = checklist.filter(c => c.productId === modal.product.id)
            await Promise.all(inList.map(item => {
                const variant = item.variant ? (data.variants || []).map(normalizeVariant).find(v => v.name === item.variant) : null
                const stores = variant?.stores?.length > 0 ? variant.stores : data.stores
                return updateDoc(doc(db, 'checklist', item.id), { name: data.name, stores, types: data.types })
            }))
        }
        setModal(null)
    }, [form, modal, checklist])

    const openAdd = () => { setForm({ name: '', stores: [], types: [], note: '', image: '', unit: '', unitCustom: '', variants: [] }); setModal({ mode: 'add' }) }
    const openAddWithName = (name) => { setForm({ name, stores: [], types: [], note: '', image: '', unit: '', unitCustom: '', variants: [] }); setModal({ mode: 'add' }) }
    const openEdit = (p) => { setForm({ name: p.name, stores: p.stores || [], types: p.types || [], note: p.note || '', image: p.image || '', unit: p.unit || '', unitCustom: p.unitCustom || '', variants: (p.variants || []).map(normalizeVariant) }); setModal({ mode: 'edit', product: p }) }
    const openView = (p, variantName, variantImage, fromChecklist, checklistItemId) => { setModal({ mode: 'view', product: p, variantName: variantName || '', variantImage: variantImage || '', fromChecklist: !!fromChecklist, checklistItemId: checklistItemId || null }) }

    return (
        <>
            <SettingsPanel isOpen={showSettings} stores={stores} types={types} onClose={() => setShowSettings(false)}
                           lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} t={t} />

            <div className="app">
                <div className="header">
                    <h1>
                        <img src="/favicon.svg" alt="Z" className="logo-icon" />
                        akup
                    </h1>
                    <div className="header-right">
                        <button className={`toggle-btn mobile-only ${viewMode === 'catalog' ? 'active' : ''}`} onClick={() => setViewMode('catalog')}><IconMenu /> {t.catalog}</button>
                        <button className={`toggle-btn mobile-only ${viewMode === 'shop' ? 'active' : ''}`} onClick={() => setViewMode('shop')}><IconCart /> {t.shop_mode}</button>
                        <button className="icon-btn" onClick={() => setShowSettings(true)} title={t.settings}><IconSettings /></button>
                    </div>
                </div>

                <div className={`columns mobile-${viewMode}`}>
                    {/* CATALOG */}
                    <div className="column catalog-column">
                        <div className="column-header">
                            <span className="column-title">{t.catalog}</span>
                            <div className="sort-chips-inline">
                                <SortDropdown value={catSort} onChange={setCatSort} options={[
                                    { value: 'alpha', label: t.sort_alpha },
                                    { value: 'type',  label: t.sort_type  },
                                    { value: 'store', label: t.sort_store },
                                ]} />
                            </div>
                            <div className="search-bar-inline">
                                <span className="search-icon"><IconSearch /></span>
                                <input className="search-input" type="text" placeholder={t.search}
                                       value={catSearch} onChange={e => setCatSearch(e.target.value)} />
                                {catSearch && <button className="search-clear" onClick={() => setCatSearch('')}><IconClose /></button>}
                            </div>
                        </div>
                        <div className="sort-row">
                            <button className={`chip ${catSort === 'alpha' ? 'active' : ''}`} onClick={() => setCatSort('alpha')}>{t.sort_alpha}</button>
                            <button className={`chip ${catSort === 'type' ? 'active' : ''}`} onClick={() => setCatSort('type')}>{t.sort_type}</button>
                            <button className={`chip ${catSort === 'store' ? 'active' : ''}`} onClick={() => setCatSort('store')}>{t.sort_store}</button>
                        </div>
                        <FilterRows stores={stores} types={types}
                                    activeStores={catActiveStores} activeTypes={catActiveTypes}
                                    onToggleStore={id => toggleFilter(id, catActiveStores, setCatActiveStores)}
                                    onToggleType={id => toggleFilter(id, catActiveTypes, setCatActiveTypes)}
                                    sortMode={catSort} t={t} />
                        <div className="items-list">
                            {catTotalItems === 0 && (
                                <div className="empty">
                                    {products.length === 0 ? t.empty_catalog : t.nothing_found}
                                    {catSearch && <button className="add-btn search-add-suggestion" onClick={() => { openAddWithName(catSearch); setCatSearch('') }}><IconAdd />{t.add_suggestion} «{catSearch}»</button>}
                                </div>
                            )}
                            {catGroups.map((group, gi) => (
                                <Fragment key={group.key}>
                                    {gi > 0 && <div className="cl-section-divider" />}
                                    {group.label && <div className="sort-group-label">{group.label}</div>}
                                    {group.items.map(product => (
                                        <CatalogItem key={product.id} product={product} inList={inChecklist(product.id)}
                                                     stores={stores} types={types} onToggle={() => toggleChecklist(product)}
                                                     onView={() => openView(product)}
                                                     onEdit={() => openEdit(product)}
                                                     onDelete={() => deleteProduct(product.id)}
                                                     t={t} />
                                    ))}
                                </Fragment>
                            ))}
                        </div>
                        <div className="add-form">
                            <button className="add-btn" onClick={openAdd}><IconAdd />{t.add_product}</button>
                        </div>
                    </div>

                    {/* CHECKLIST */}
                    <div className="column checklist-column">
                        <div className="column-header">
                            <span className="column-title">{t.shopping_list}</span>
                            <div className="sort-chips-inline">
                                <SortDropdown value={clSort} onChange={setClSort} options={[
                                    { value: 'alpha',      label: t.sort_alpha      },
                                    { value: 'type',       label: t.sort_type       },
                                    { value: 'store',      label: t.sort_store      },
                                    { value: 'regularity', label: t.sort_regularity },
                                ]} />
                            </div>
                            <div className="column-header-right">
                                <span className="column-count">{checklist.filter(c => !c.done).length} / {checklist.length}</span>
                                {checklist.some(c => c.done) && <button className="chip" onClick={clearDone}>{t.clear_done}</button>}
                            </div>
                        </div>
                        <div className="sort-row">
                            <button className={`chip ${clSort === 'alpha' ? 'active' : ''}`} onClick={() => setClSort('alpha')}>{t.sort_alpha}</button>
                            <button className={`chip ${clSort === 'type' ? 'active' : ''}`} onClick={() => setClSort('type')}>{t.sort_type}</button>
                            <button className={`chip ${clSort === 'store' ? 'active' : ''}`} onClick={() => setClSort('store')}>{t.sort_store}</button>
                            <button className={`chip ${clSort === 'regularity' ? 'active' : ''}`} onClick={() => setClSort('regularity')}>{t.sort_regularity}</button>
                        </div>
                        <FilterRows stores={stores} types={types}
                                    activeStores={clActiveStores} activeTypes={clActiveTypes}
                                    onToggleStore={id => toggleFilter(id, clActiveStores, setClActiveStores)}
                                    onToggleType={id => toggleFilter(id, clActiveTypes, setClActiveTypes)}
                                    checklist={checklist} sortMode={clSort} t={t} />
                        <div className="items-list">
                            {clTotalItems === 0 && <div className="empty">{checklist.length === 0 ? t.tap_to_add : t.nothing_found}</div>}
                            {(() => {
                                const renderItem = (item) => (
                                    <ChecklistItem key={item.id} item={item} types={types} stores={stores}
                                                   lastAddedId={lastAddedId} editingCommentId={editingCommentId} setEditingCommentId={setEditingCommentId}
                                                   onToggle={() => toggleDone(item)} onRemove={() => removeFromChecklist(item.id)}
                                                   onView={() => { const p = products.find(p => p.id === item.productId); if (!p) return; if (item.variant) { const v = (p.variants || []).map(normalizeVariant).find(v => v.name === item.variant); openView(p, item.variant, v?.image || '', true, item.id) } else { openView(p, '', '', true, item.id) } }}
                                                   t={t} />
                                )
                                return clGroups.map((group, gi) => (
                                    <Fragment key={group.key}>
                                        {gi > 0 && <div className="cl-section-divider" />}
                                        {group.label && <div className="sort-group-label">{group.label}</div>}
                                        {group.items.map(renderItem)}
                                    </Fragment>
                                ))
                            })()}
                        </div>
                        <div className="add-form onetime-form">
                            <div className="tag-add-row">
                                <label className="onetime-input-wrap">
                                    <input
                                        className="onetime-input-field"
                                        type="text"
                                        placeholder={t.add_onetime}
                                        value={oneTimeInput}
                                        onChange={e => setOneTimeInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && oneTimeInput.trim()) {
                                                addOneTimeItem(oneTimeInput)
                                                setOneTimeInput('')
                                            }
                                            if (e.key === 'Escape') setOneTimeInput('')
                                        }}
                                    />
                                </label>
                                <button className="tag-add-btn" onClick={() => { if (oneTimeInput.trim()) { addOneTimeItem(oneTimeInput); setOneTimeInput('') } }}>
                                    <IconAdd />
                                </button>
                            </div>
                        </div>
                        <ShopNoteModal t={t} />
                    </div>
                </div>
            </div>

            {variantPicker && (
                <VariantPickerModal
                    product={variantPicker.product}
                    onAdd={(variant) => addToChecklistWithVariant(variantPicker.product, variant)}
                    onClose={() => setVariantPicker(null)}
                    t={t}
                />
            )}

            {modal && (
                <ProductModal
                    modal={modal}
                    form={form}
                    setForm={setForm}
                    stores={stores}
                    types={types}
                    onClose={() => setModal(null)}
                    onSave={saveProduct}
                    onDelete={deleteProduct}
                    onEdit={openEdit}
                    onToggleChecklist={toggleChecklist}
                    onRemoveFromChecklist={removeFromChecklist}
                    inChecklist={inChecklist}
                    t={t}
                />
            )}
        </>
    )
}
