import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from './firebase'
import {
    collection, addDoc, deleteDoc, updateDoc,
    doc, onSnapshot, query, orderBy
} from 'firebase/firestore'

const CATEGORIES = ['Все', 'Еда', 'Бытовое', 'Косметика', 'Другое']
const LONG_PRESS_MS = 500

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f0f0f;
    --surface: #181818;
    --surface2: #222;
    --border: #2a2a2a;
    --accent: #c8f04a;
    --accent2: #4af0c8;
    --text: #f0f0f0;
    --muted: #666;
    --danger: #ff4a4a;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', sans-serif;
    min-height: 100vh;
  }

  .app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
  }

  .header h1 {
    font-family: 'Syne', sans-serif;
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--accent);
  }

  .header-sub {
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 300;
  }

  .view-toggle {
    display: flex;
    gap: 6px;
    margin-left: auto;
  }

  .toggle-btn {
    font-family: 'Inter', sans-serif;
    font-size: 0.75rem;
    font-weight: 500;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-btn:hover { border-color: var(--text); color: var(--text); }
  .toggle-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .column {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .column-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .column-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .column-count {
    font-size: 0.7rem;
    background: var(--surface2);
    color: var(--muted);
    padding: 2px 8px;
    border-radius: 20px;
  }

  .filters {
    padding: 10px 16px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .filter-btn {
    font-family: 'Inter', sans-serif;
    font-size: 0.7rem;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }

  .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
  .filter-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

  .items-list {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: calc(100vh - 280px);
    overflow-y: auto;
    flex: 1;
  }

  .items-list::-webkit-scrollbar { width: 4px; }
  .items-list::-webkit-scrollbar-track { background: transparent; }
  .items-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* Catalog item */
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface2);
    border: 1px solid transparent;
    cursor: pointer;
    user-select: none;
    transition: background 0.12s, border-color 0.12s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }

  .item:hover { border-color: var(--border); }
  .item:active { transform: scale(0.985); }
  .item.in-list { border-color: rgba(200, 240, 74, 0.25); }

  .item-check {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.5px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6rem;
    transition: all 0.15s;
    color: transparent;
  }

  .item.in-list .item-check {
    border-color: var(--accent);
    background: var(--accent);
    color: #000;
  }

  .item-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 400;
    pointer-events: none;
  }

  .item-category {
    font-size: 0.65rem;
    color: var(--muted);
    background: var(--surface);
    padding: 2px 6px;
    border-radius: 4px;
    pointer-events: none;
  }

  /* Checklist column */
  .checklist-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface2);
    border: 1px solid transparent;
    cursor: pointer;
    user-select: none;
    transition: all 0.12s;
    -webkit-tap-highlight-color: transparent;
  }

  .checklist-item:hover { border-color: var(--border); }

  .checklist-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
    flex-shrink: 0;
    pointer-events: none;
  }

  .item-name.done { text-decoration: line-through; color: var(--muted); }

  .cl-remove {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    opacity: 0;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .checklist-item:hover .cl-remove { opacity: 1; }
  .cl-remove:hover { border-color: var(--danger); color: var(--danger); }

  /* Context menu */
  .ctx-menu {
    position: fixed;
    z-index: 200;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 6px;
    min-width: 190px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    animation: ctx-in 0.12s ease;
  }

  @keyframes ctx-in {
    from { opacity: 0; transform: scale(0.95) translateY(-4px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  .ctx-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.1s;
    user-select: none;
  }

  .ctx-item:hover { background: var(--surface2); }
  .ctx-item.danger { color: var(--danger); }
  .ctx-item.danger:hover { background: rgba(255,74,74,0.08); }
  .ctx-icon { font-size: 0.9rem; width: 18px; text-align: center; }
  .ctx-divider { height: 1px; background: var(--border); margin: 4px 6px; }

  /* Bottom sheet */
  .sheet-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .bottom-sheet {
    width: 100%;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-radius: 20px 20px 0 0;
    padding: 8px 0 32px;
    animation: sheet-up 0.25s ease;
  }

  @keyframes sheet-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  .sheet-handle {
    width: 36px;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 8px auto 16px;
  }

  .sheet-title {
    font-family: 'Syne', sans-serif;
    font-size: 1rem;
    font-weight: 700;
    padding: 0 20px 14px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 6px;
  }

  .sheet-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 20px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.1s;
    user-select: none;
  }

  .sheet-item:hover { background: var(--surface2); }
  .sheet-item.danger { color: var(--danger); }
  .sheet-icon { font-size: 1.1rem; width: 22px; text-align: center; }

  /* Add form */
  .add-form {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  .add-btn {
    width: 100%;
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: 10px;
    padding: 9px;
    color: var(--muted);
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .add-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* Modal */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 300;
    padding: 24px;
    animation: fade-in 0.15s ease;
  }

  .modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    width: 100%;
    max-width: 480px;
    overflow: hidden;
  }

  .modal-header {
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .modal-title {
    font-family: 'Syne', sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .modal-body {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .modal-img {
    width: 100%;
    height: 180px;
    object-fit: cover;
    border-radius: 10px;
  }

  .modal-img-placeholder {
    width: 100%;
    height: 100px;
    border-radius: 10px;
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 0.8rem;
  }

  .modal-note {
    font-size: 0.875rem;
    color: var(--muted);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .field-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 6px;
  }

  .field-input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    color: var(--text);
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s;
  }

  .field-input:focus { border-color: var(--accent); }
  textarea.field-input { resize: vertical; min-height: 80px; font-family: 'Inter', sans-serif; }
  select.field-input { cursor: pointer; }

  .modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn-secondary {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 16px;
    color: var(--muted);
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-secondary:hover { border-color: var(--text); color: var(--text); }

  .btn-primary {
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 8px 16px;
    font-family: 'Syne', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .btn-primary:hover { opacity: 0.85; }

  .btn-danger {
    background: transparent;
    border: 1px solid var(--danger);
    border-radius: 8px;
    padding: 8px 16px;
    color: var(--danger);
    font-family: 'Inter', sans-serif;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.15s;
    margin-right: auto;
  }

  .btn-danger:hover { background: rgba(255,74,74,0.1); }

  .icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .icon-btn:hover { background: var(--surface2); color: var(--text); }

  .empty {
    padding: 32px 20px;
    text-align: center;
    color: var(--muted);
    font-size: 0.8rem;
  }

  /* Shop mode */
  .shop-view { max-width: 560px; margin: 0 auto; }

  .shop-checklist-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    border-radius: 10px;
    background: var(--surface2);
    border: 1px solid transparent;
    transition: all 0.15s;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .shop-checklist-item:hover { border-color: var(--border); }
  .shop-checklist-item.done-item { opacity: 0.45; }

  .shop-checkbox {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    font-size: 0.7rem;
    color: transparent;
  }

  .shop-checklist-item.done-item .shop-checkbox {
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
  }

  .shop-item-name { flex: 1; font-size: 1rem; }
  .shop-item-name.done { text-decoration: line-through; color: var(--muted); }

  @media (max-width: 700px) {
    .columns { grid-template-columns: 1fr; }
    .header-sub { display: none; }
  }
`

// ─── Long press hook ───────────────────────────────────────────────
function useLongPress(onLongPress, onClick, ms = LONG_PRESS_MS) {
    const timerRef = useRef(null)
    const firedRef = useRef(false)
    const movedRef = useRef(false)

    const start = useCallback((e) => {
        movedRef.current = false
        firedRef.current = false
        timerRef.current = setTimeout(() => {
            if (!movedRef.current) {
                firedRef.current = true
                onLongPress(e)
            }
        }, ms)
    }, [onLongPress, ms])

    const move = useCallback(() => {
        movedRef.current = true
        clearTimeout(timerRef.current)
    }, [])

    const cancel = useCallback(() => {
        clearTimeout(timerRef.current)
    }, [])

    const handleClick = useCallback((e) => {
        if (firedRef.current) { firedRef.current = false; return }
        onClick(e)
    }, [onClick])

    return {
        onTouchStart: start,
        onTouchMove: move,
        onTouchEnd: cancel,
        onClick: handleClick,
    }
}

// ─── Context Menu ──────────────────────────────────────────────────
function ContextMenu({ x, y, items, onClose }) {
    const menuRef = useRef(null)
    const [pos, setPos] = useState({ x, y })

    useEffect(() => {
        if (menuRef.current) {
            const { offsetWidth: w, offsetHeight: h } = menuRef.current
            setPos({
                x: Math.min(x, window.innerWidth - w - 8),
                y: Math.min(y, window.innerHeight - h - 8),
            })
        }
        const close = () => onClose()
        window.addEventListener('mousedown', close)
        return () => window.removeEventListener('mousedown', close)
    }, [x, y, onClose])

    return (
        <div
            ref={menuRef}
            className="ctx-menu"
            style={{ left: pos.x, top: pos.y }}
            onMouseDown={e => e.stopPropagation()}
        >
            {items.map((item, i) =>
                item === 'divider'
                    ? <div key={i} className="ctx-divider" />
                    : (
                        <div key={i} className={`ctx-item ${item.danger ? 'danger' : ''}`}
                             onClick={() => { item.action(); onClose() }}>
                            <span className="ctx-icon">{item.icon}</span>
                            {item.label}
                        </div>
                    )
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
                {items.map((item, i) =>
                    item === 'divider'
                        ? <div key={i} className="ctx-divider" style={{ margin: '4px 20px' }} />
                        : (
                            <div key={i} className={`sheet-item ${item.danger ? 'danger' : ''}`}
                                 onClick={() => { item.action(); onClose() }}>
                                <span className="sheet-icon">{item.icon}</span>
                                {item.label}
                            </div>
                        )
                )}
            </div>
        </div>
    )
}

// ─── CatalogItem ───────────────────────────────────────────────────
function CatalogItem({ product, inList, onToggle, onContextMenu, onLongPress }) {
    const handlers = useLongPress(onLongPress, onToggle)
    return (
        <div
            className={`item ${inList ? 'in-list' : ''}`}
            onContextMenu={onContextMenu}
            {...handlers}
        >
            <div className="item-check">{inList && '✓'}</div>
            <span className="item-name">{product.name}</span>
            {product.category && <span className="item-category">{product.category}</span>}
        </div>
    )
}

// ─── App ───────────────────────────────────────────────────────────
export default function App() {
    const [products, setProducts] = useState([])
    const [checklist, setChecklist] = useState([])
    const [filter, setFilter] = useState('Все')
    const [modal, setModal] = useState(null)
    const [form, setForm] = useState({ name: '', category: 'Еда', note: '', image: '' })
    const [viewMode, setViewMode] = useState('both')
    const [ctxMenu, setCtxMenu] = useState(null)
    const [sheet, setSheet] = useState(null)

    useEffect(() => {
        const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
        return onSnapshot(q, snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    }, [])

    useEffect(() => {
        const q = query(collection(db, 'checklist'), orderBy('addedAt', 'desc'))
        let firstLoad = true
        return onSnapshot(q, snap => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            setChecklist(data)
            if (firstLoad) {
                firstLoad = false
                if (data.length > 0) setViewMode('shop')
            }
        })
    }, [])

    const inChecklist = useCallback((id) => checklist.some(c => c.productId === id), [checklist])

    const toggleChecklist = useCallback(async (product) => {
        const existing = checklist.find(c => c.productId === product.id)
        if (existing) {
            await deleteDoc(doc(db, 'checklist', existing.id))
        } else {
            await addDoc(collection(db, 'checklist'), {
                productId: product.id,
                name: product.name,
                done: false,
                addedAt: Date.now()
            })
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
        if (modal.mode === 'add') {
            await addDoc(collection(db, 'products'), {
                name: form.name.trim(), category: form.category,
                note: form.note.trim(), image: form.image.trim(),
                createdAt: Date.now()
            })
        } else {
            await updateDoc(doc(db, 'products', modal.product.id), {
                name: form.name.trim(), category: form.category,
                note: form.note.trim(), image: form.image.trim(),
            })
        }
        setModal(null)
    }, [form, modal])

    const openAdd = () => { setForm({ name: '', category: 'Еда', note: '', image: '' }); setModal({ mode: 'add' }) }
    const openEdit = (p) => { setForm({ name: p.name, category: p.category || 'Еда', note: p.note || '', image: p.image || '' }); setModal({ mode: 'edit', product: p }) }
    const openView = (p) => setModal({ mode: 'view', product: p })

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

    const filtered = filter === 'Все' ? products : products.filter(p => p.category === filter)

    return (
        <>
            <style>{styles}</style>

            {ctxMenu && (
                <ContextMenu
                    x={ctxMenu.x} y={ctxMenu.y}
                    items={menuItems(ctxMenu.product)}
                    onClose={() => setCtxMenu(null)}
                />
            )}

            {sheet && (
                <BottomSheet
                    title={sheet.product.name}
                    items={menuItems(sheet.product)}
                    onClose={() => setSheet(null)}
                />
            )}

            <div className="app">
                <div className="header">
                    <h1>Закупки</h1>
                    <span className="header-sub">общий список</span>
                    <div className="view-toggle">
                        <button className={`toggle-btn ${viewMode === 'both' ? 'active' : ''}`} onClick={() => setViewMode('both')}>☰ Каталог</button>
                        <button className={`toggle-btn ${viewMode === 'shop' ? 'active' : ''}`} onClick={() => setViewMode('shop')}>🛒 Магазин</button>
                    </div>
                </div>

                {viewMode === 'shop' ? (
                    <div className="shop-view">
                        <div className="column">
                            <div className="column-header">
                                <span className="column-title">Список покупок</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span className="column-count">{checklist.filter(c => !c.done).length} / {checklist.length}</span>
                                    {checklist.some(c => c.done) && (
                                        <button className="filter-btn" onClick={clearDone}>Очистить купленное</button>
                                    )}
                                </div>
                            </div>
                            <div className="items-list">
                                {checklist.length === 0 && <div className="empty">Список пуст — добавьте товары в каталоге</div>}
                                {checklist.map(item => (
                                    <div key={item.id} className={`shop-checklist-item ${item.done ? 'done-item' : ''}`} onClick={() => toggleDone(item)}>
                                        <div className="shop-checkbox">{item.done && '✓'}</div>
                                        <span className={`shop-item-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                                        <button className="icon-btn" style={{ opacity: 0.35 }} onClick={e => { e.stopPropagation(); removeFromChecklist(item.id) }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="columns">
                        <div className="column">
                            <div className="column-header">
                                <span className="column-title">Каталог</span>
                                <span className="column-count">{filtered.length}</span>
                            </div>
                            <div className="filters">
                                {CATEGORIES.map(cat => (
                                    <button key={cat} className={`filter-btn ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>{cat}</button>
                                ))}
                            </div>
                            <div className="items-list">
                                {filtered.length === 0 && <div className="empty">Пусто</div>}
                                {filtered.map(product => (
                                    <CatalogItem
                                        key={product.id}
                                        product={product}
                                        inList={inChecklist(product.id)}
                                        onToggle={() => toggleChecklist(product)}
                                        onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, product }) }}
                                        onLongPress={() => setSheet({ product })}
                                    />
                                ))}
                            </div>
                            <div className="add-form">
                                <button className="add-btn" onClick={openAdd}>+ Добавить продукт</button>
                            </div>
                        </div>

                        <div className="column">
                            <div className="column-header">
                                <span className="column-title">Список покупок</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span className="column-count">{checklist.filter(c => !c.done).length} / {checklist.length}</span>
                                    {checklist.some(c => c.done) && (
                                        <button className="filter-btn" onClick={clearDone}>Очистить</button>
                                    )}
                                </div>
                            </div>
                            <div className="items-list">
                                {checklist.length === 0 && <div className="empty">Нажмите на продукт чтобы добавить</div>}
                                {checklist.map(item => (
                                    <div key={item.id} className="checklist-item" onClick={() => toggleDone(item)}>
                                        <input type="checkbox" checked={item.done} readOnly />
                                        <span className={`item-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                                        <button className="cl-remove" onClick={e => { e.stopPropagation(); removeFromChecklist(item.id) }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

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
                                        ? <img className="modal-img" src={modal.product.image} alt={modal.product.name} />
                                        : <div className="modal-img-placeholder">Нет изображения</div>
                                    }
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
                                    <div>
                                        <div className="field-label">Категория</div>
                                        <select className="field-input" value={form.category}
                                                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                            {CATEGORIES.filter(c => c !== 'Все').map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <div className="field-label">Ссылка на фото</div>
                                        <input className="field-input" value={form.image}
                                               onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                                               placeholder="https://..." />
                                    </div>
                                    <div>
                                        <div className="field-label">Заметка</div>
                                        <textarea className="field-input" value={form.note}
                                                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                                                  placeholder="Бренд, магазин, детали..." />
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