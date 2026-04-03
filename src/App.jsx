import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from './firebase'
import {
    collection, addDoc, deleteDoc, updateDoc,
    doc, onSnapshot, query, orderBy
} from 'firebase/firestore'

const LONG_PRESS_MS = 500
const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'уп', 'своя']

// ─── Styles ────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f0f0f;
    --surface: #181818;
    --surface2: #222;
    --border: #2a2a2a;
    --accent: #c8f04a;
    --text: #f0f0f0;
    --muted: #555;
    --danger: #ff4a4a;
  }

  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; min-height: 100vh; }

  /* ── Layout ── */
  .app { max-width: 1200px; margin: 0 auto; padding: 28px 24px; }

  .header {
    display: flex; align-items: center; gap: 14px; margin-bottom: 28px;
  }
  .header h1 {
    font-family: 'Syne', sans-serif; font-size: 1.8rem; font-weight: 800;
    letter-spacing: -0.03em; color: var(--accent);
  }
  .header-sub { font-size: 0.78rem; color: var(--muted); }
  .header-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }

  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

  .column {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
  }

  .column-header {
    padding: 14px 18px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .column-title {
    font-family: 'Syne', sans-serif; font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
  }
  .column-count {
    font-size: 0.68rem; background: var(--surface2); color: var(--muted);
    padding: 2px 8px; border-radius: 20px;
  }

  /* ── Filter rows ── */
  .filter-section { border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .filter-row { padding: 8px 14px; display: flex; gap: 5px; flex-wrap: wrap; }
  .filter-row + .filter-row { padding-top: 0; border-top: 1px solid var(--border); }

  .filter-label {
    font-size: 0.6rem; color: var(--muted); text-transform: uppercase;
    letter-spacing: 0.1em; padding: 0 14px 5px; display: block;
  }

  .chip {
    font-family: 'Inter', sans-serif; font-size: 0.68rem; font-weight: 500;
    padding: 3px 9px; border-radius: 20px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer;
    transition: all 0.13s; user-select: none; white-space: nowrap;
  }
  .chip:hover { border-color: var(--accent); color: var(--accent); }
  .chip.active { background: var(--accent); color: #000; border-color: var(--accent); }

  /* ── Items list ── */
  .items-list {
    padding: 8px; display: flex; flex-direction: column; gap: 4px;
    max-height: calc(100vh - 320px); overflow-y: auto; flex: 1;
  }
  .items-list::-webkit-scrollbar { width: 3px; }
  .items-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* ── Catalog item ── */
  .item {
    display: flex; align-items: center; gap: 9px; padding: 9px 11px;
    border-radius: 9px; background: var(--surface2); border: 1px solid transparent;
    cursor: pointer; user-select: none; transition: border-color 0.12s, transform 0.1s;
    -webkit-tap-highlight-color: transparent;
  }
  .item:hover { border-color: var(--border); }
  .item:active { transform: scale(0.985); }
  .item.in-list { border-color: rgba(200,240,74,0.2); }

  .item-check {
    width: 17px; height: 17px; border-radius: 50%; border: 1.5px solid var(--border);
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    font-size: 0.58rem; transition: all 0.15s; color: transparent;
  }
  .item.in-list .item-check { border-color: var(--accent); background: var(--accent); color: #000; }

  .item-name { flex: 1; font-size: 0.85rem; pointer-events: none; }

  .item-tags { display: flex; gap: 4px; pointer-events: none; }
  .item-tag {
    font-size: 0.6rem; color: var(--muted); background: var(--surface);
    padding: 1px 6px; border-radius: 4px; white-space: nowrap;
  }

  /* ── Checklist item ── */
  .checklist-item {
    display: flex; align-items: center; gap: 9px; padding: 9px 11px;
    border-radius: 9px; background: var(--surface2); border: 1px solid transparent;
    cursor: pointer; user-select: none; transition: border-color 0.12s;
    -webkit-tap-highlight-color: transparent;
  }
  .checklist-item:hover { border-color: var(--border); }
  .checklist-item input[type="checkbox"] {
    width: 15px; height: 15px; accent-color: var(--accent);
    cursor: pointer; flex-shrink: 0; pointer-events: none;
  }
  .item-name.done { text-decoration: line-through; color: var(--muted); }

  .cl-tags { display: flex; gap: 4px; }
  .cl-tag { font-size: 0.6rem; color: var(--muted); background: var(--surface); padding: 1px 6px; border-radius: 4px; }

  .cl-remove {
    width: 22px; height: 22px; border-radius: 5px; border: 1px solid transparent;
    background: transparent; color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 0.7rem;
    opacity: 0; transition: all 0.13s; flex-shrink: 0;
  }
  .checklist-item:hover .cl-remove { opacity: 1; }
  .cl-remove:hover { border-color: var(--danger); color: var(--danger); }

  /* ── Add form ── */
  .add-form { padding: 10px 14px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .add-btn {
    width: 100%; background: transparent; border: 1px dashed var(--border);
    border-radius: 9px; padding: 8px; color: var(--muted);
    font-family: 'Inter', sans-serif; font-size: 0.82rem; cursor: pointer; transition: all 0.15s;
  }
  .add-btn:hover { border-color: var(--accent); color: var(--accent); }

  /* ── Toggle buttons ── */
  .toggle-btn {
    font-family: 'Inter', sans-serif; font-size: 0.72rem; font-weight: 500;
    padding: 5px 11px; border-radius: 20px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer; transition: all 0.13s;
  }
  .toggle-btn:hover { border-color: var(--text); color: var(--text); }
  .toggle-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

  /* ── Settings panel ── */
  .settings-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 150;
    animation: fade-in 0.15s ease;
  }
  .settings-panel {
    position: fixed; top: 0; right: 0; bottom: 0; width: 320px;
    background: var(--surface); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; z-index: 151;
    animation: slide-in 0.2s ease;
  }
  @keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }

  .settings-header {
    padding: 20px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .settings-title { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; }
  .settings-body { padding: 16px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 24px; }

  .settings-section-title {
    font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--muted); margin-bottom: 10px;
  }

  .tag-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }

  .tag-row {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px;
    background: var(--surface2); border-radius: 8px; border: 1px solid var(--border);
  }
  .tag-row-name { flex: 1; font-size: 0.85rem; }
  .tag-row-icon {
    width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
    border-radius: 5px; border: 1px solid transparent; cursor: pointer;
    font-size: 0.7rem; color: var(--muted); background: transparent; transition: all 0.12s;
  }
  .tag-row-icon:hover { border-color: var(--danger); color: var(--danger); }

  .tag-add-row { display: flex; gap: 6px; }
  .tag-input {
    flex: 1; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 10px; color: var(--text);
    font-family: 'Inter', sans-serif; font-size: 0.82rem; outline: none; transition: border-color 0.13s;
  }
  .tag-input:focus { border-color: var(--accent); }
  .tag-add-btn {
    background: var(--accent); color: #000; border: none; border-radius: 8px;
    padding: 7px 12px; font-family: 'Syne', sans-serif; font-size: 0.75rem;
    font-weight: 700; cursor: pointer; white-space: nowrap;
  }

  /* ── Context menu ── */
  .ctx-menu {
    position: fixed; z-index: 200; background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 6px; min-width: 190px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6); animation: ctx-in 0.12s ease;
  }
  @keyframes ctx-in { from { opacity:0; transform: scale(0.95) translateY(-4px); } to { opacity:1; transform: scale(1) translateY(0); } }
  .ctx-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px;
    border-radius: 8px; font-size: 0.875rem; cursor: pointer; transition: background 0.1s; user-select: none;
  }
  .ctx-item:hover { background: var(--surface2); }
  .ctx-item.danger { color: var(--danger); }
  .ctx-item.danger:hover { background: rgba(255,74,74,0.08); }
  .ctx-icon { font-size: 0.9rem; width: 18px; text-align: center; }
  .ctx-divider { height: 1px; background: var(--border); margin: 4px 6px; }

  /* ── Bottom sheet ── */
  .sheet-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200;
    display: flex; align-items: flex-end; animation: fade-in 0.2s ease;
  }
  @keyframes fade-in { from { opacity:0; } to { opacity:1; } }
  .bottom-sheet {
    width: 100%; background: var(--surface); border-top: 1px solid var(--border);
    border-radius: 20px 20px 0 0; padding: 8px 0 32px; animation: sheet-up 0.25s ease;
  }
  @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .sheet-handle { width: 36px; height: 4px; background: var(--border); border-radius: 2px; margin: 8px auto 16px; }
  .sheet-title { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 700; padding: 0 20px 14px; border-bottom: 1px solid var(--border); margin-bottom: 6px; }
  .sheet-item { display: flex; align-items: center; gap: 14px; padding: 14px 20px; font-size: 1rem; cursor: pointer; transition: background 0.1s; user-select: none; }
  .sheet-item:hover { background: var(--surface2); }
  .sheet-item.danger { color: var(--danger); }
  .sheet-icon { font-size: 1.1rem; width: 22px; text-align: center; }

  /* ── Modal ── */
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75);
    display: flex; align-items: center; justify-content: center; z-index: 300;
    padding: 24px; animation: fade-in 0.15s ease;
  }
  .modal {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; width: 100%; max-width: 500px; overflow: hidden;
    max-height: 90vh; display: flex; flex-direction: column;
  }
  .modal-header {
    padding: 18px 22px 14px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .modal-title { font-family: 'Syne', sans-serif; font-size: 1.05rem; font-weight: 700; }
  .modal-body { padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
  .modal-img { width: 100%; height: 160px; object-fit: cover; border-radius: 10px; }
  .modal-img-placeholder {
    width: 100%; height: 80px; border-radius: 10px; background: var(--surface2);
    display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.78rem;
  }
  .modal-note { font-size: 0.85rem; color: var(--muted); line-height: 1.6; white-space: pre-wrap; }

  .field-label { font-size: 0.67rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
  .field-input {
    width: 100%; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 11px; color: var(--text);
    font-family: 'Inter', sans-serif; font-size: 0.85rem; outline: none; transition: border-color 0.13s;
  }
  .field-input:focus { border-color: var(--accent); }
  textarea.field-input { resize: vertical; min-height: 70px; font-family: 'Inter', sans-serif; }

  /* Multi-select tags in form */
  .multi-select { display: flex; flex-wrap: wrap; gap: 5px; }
  .ms-chip {
    font-size: 0.72rem; padding: 4px 10px; border-radius: 20px;
    border: 1px solid var(--border); background: transparent; color: var(--muted);
    cursor: pointer; transition: all 0.12s; user-select: none;
  }
  .ms-chip:hover { border-color: var(--text); color: var(--text); }
  .ms-chip.selected { background: var(--accent); color: #000; border-color: var(--accent); }

  .modal-footer {
    padding: 14px 22px; border-top: 1px solid var(--border);
    display: flex; gap: 8px; justify-content: flex-end; flex-shrink: 0;
  }
  .btn-secondary {
    background: transparent; border: 1px solid var(--border); border-radius: 8px;
    padding: 7px 14px; color: var(--muted); font-family: 'Inter', sans-serif;
    font-size: 0.85rem; cursor: pointer; transition: all 0.13s;
  }
  .btn-secondary:hover { border-color: var(--text); color: var(--text); }
  .btn-primary {
    background: var(--accent); color: #000; border: none; border-radius: 8px;
    padding: 7px 14px; font-family: 'Syne', sans-serif; font-size: 0.78rem;
    font-weight: 700; cursor: pointer; transition: opacity 0.13s;
  }
  .btn-primary:hover { opacity: 0.85; }
  .btn-danger {
    background: transparent; border: 1px solid var(--danger); border-radius: 8px;
    padding: 7px 14px; color: var(--danger); font-family: 'Inter', sans-serif;
    font-size: 0.85rem; cursor: pointer; transition: all 0.13s; margin-right: auto;
  }
  .btn-danger:hover { background: rgba(255,74,74,0.1); }
  .icon-btn {
    width: 28px; height: 28px; border-radius: 7px; border: 1px solid var(--border);
    background: transparent; color: var(--muted); cursor: pointer;
    display: flex; align-items: center; justify-content: center; font-size: 0.78rem;
    transition: all 0.13s; flex-shrink: 0;
  }
  .icon-btn:hover { background: var(--surface2); color: var(--text); }

  .empty { padding: 28px 16px; text-align: center; color: var(--muted); font-size: 0.78rem; }

  /* ── Quantity ── */
  .qty-wrap { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
  .qty-input {
    width: 44px; background: var(--surface); border: 1px solid var(--border);
    border-radius: 6px; padding: 3px 5px; color: var(--text);
    font-family: 'Inter', sans-serif; font-size: 0.8rem; outline: none;
    text-align: right; transition: border-color 0.13s;
  }
  .qty-input:focus { border-color: var(--accent); }
  .qty-unit { font-size: 0.72rem; color: var(--muted); white-space: nowrap; min-width: 16px; }

  .unit-row { display: flex; gap: 6px; align-items: center; }
  .unit-select {
    flex: 1; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 8px; color: var(--text);
    font-family: 'Inter', sans-serif; font-size: 0.82rem; outline: none;
    cursor: pointer; transition: border-color 0.13s;
  }
  .unit-select:focus { border-color: var(--accent); }
  .unit-custom-input {
    flex: 1; background: var(--surface2); border: 1px solid var(--border);
    border-radius: 8px; padding: 7px 10px; color: var(--text);
    font-family: 'Inter', sans-serif; font-size: 0.82rem; outline: none;
    transition: border-color 0.13s;
  }
  .unit-custom-input:focus { border-color: var(--accent); }

  /* ── Shop mode ── */
  .shop-view { max-width: 560px; margin: 0 auto; }
  .shop-checklist-item {
    display: flex; align-items: center; gap: 12px; padding: 13px 14px;
    border-radius: 10px; background: var(--surface2); border: 1px solid transparent;
    transition: all 0.13s; cursor: pointer; user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .shop-checklist-item:hover { border-color: var(--border); }
  .shop-checklist-item.done-item { opacity: 0.4; }
  .shop-checkbox {
    width: 21px; height: 21px; border-radius: 50%; border: 2px solid var(--border);
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    transition: all 0.13s; font-size: 0.68rem; color: transparent;
  }
  .shop-checklist-item.done-item .shop-checkbox { background: var(--accent); border-color: var(--accent); color: #000; }
  .shop-item-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .shop-item-name { font-size: 0.95rem; }
  .shop-item-name.done { text-decoration: line-through; color: var(--muted); }
  .shop-item-tags { display: flex; gap: 4px; }
  .shop-tag { font-size: 0.6rem; color: var(--muted); background: var(--surface); padding: 1px 6px; border-radius: 4px; }

  @media (max-width: 720px) {
    .columns { grid-template-columns: 1fr; }
    .header-sub { display: none; }
    .settings-panel { width: 100%; }
  }
`

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
                    {/* Stores */}
                    <div>
                        <div className="settings-section-title">Магазины</div>
                        <div className="tag-list">
                            {stores.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Нет магазинов</div>}
                            {stores.map(s => (
                                <div key={s.id} className="tag-row">
                                    <span className="tag-row-name">{s.name}</span>
                                    <button className="tag-row-icon" onClick={() => delStore(s.id)}>✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="tag-add-row">
                            <input
                                className="tag-input" value={newStore} placeholder="Название магазина"
                                onChange={e => setNewStore(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addStore()}
                            />
                            <button className="tag-add-btn" onClick={addStore}>+ Добавить</button>
                        </div>
                    </div>

                    {/* Types */}
                    <div>
                        <div className="settings-section-title">Типы товаров</div>
                        <div className="tag-list">
                            {types.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Нет типов</div>}
                            {types.map(t => (
                                <div key={t.id} className="tag-row">
                                    <span className="tag-row-name">{t.name}</span>
                                    <button className="tag-row-icon" onClick={() => delType(t.id)}>✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="tag-add-row">
                            <input
                                className="tag-input" value={newType} placeholder="Название типа"
                                onChange={e => setNewType(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addType()}
                            />
                            <button className="tag-add-btn" onClick={addType}>+ Добавить</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

// ─── Filter rows component ─────────────────────────────────────────
function FilterRows({ stores, types, activeStores, activeTypes, onToggleStore, onToggleType }) {
    if (stores.length === 0 && types.length === 0) return null
    return (
        <div className="filter-section">
            {types.length > 0 && (
                <div className="filter-row">
                    <span className="chip" style={{ border: 'none', padding: '3px 4px', fontSize: '0.58rem', color: 'var(--muted)', cursor: 'default' }}>Тип:</span>
                    {types.map(t => (
                        <button key={t.id} className={`chip ${activeTypes.includes(t.id) ? 'active' : ''}`} onClick={() => onToggleType(t.id)}>{t.name}</button>
                    ))}
                </div>
            )}
            {stores.length > 0 && (
                <div className="filter-row">
                    <span className="chip" style={{ border: 'none', padding: '3px 4px', fontSize: '0.58rem', color: 'var(--muted)', cursor: 'default' }}>Магазин:</span>
                    {stores.map(s => (
                        <button key={s.id} className={`chip ${activeStores.includes(s.id) ? 'active' : ''}`} onClick={() => onToggleStore(s.id)}>{s.name}</button>
                    ))}
                </div>
            )}
        </div>
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
            {item.unit && <span className="qty-unit">{item.unit}</span>}
        </div>
    )
}

// ─── App ───────────────────────────────────────────────────────────
export default function App() {
    const [products, setProducts] = useState([])
    const [checklist, setChecklist] = useState([])
    const [stores, setStores] = useState([])
    const [types, setTypes] = useState([])

    const [viewMode, setViewMode] = useState('both')
    const [showSettings, setShowSettings] = useState(false)
    const [modal, setModal] = useState(null)
    const [form, setForm] = useState({ name: '', stores: [], types: [], note: '', image: '' })

    const [ctxMenu, setCtxMenu] = useState(null)
    const [sheet, setSheet] = useState(null)
    const [lastAddedId, setLastAddedId] = useState(null)

    useEffect(() => {
        if (lastAddedId) {
            const t = setTimeout(() => setLastAddedId(null), 300)
            return () => clearTimeout(t)
        }
    }, [lastAddedId])

    // Filters — catalog
    const [catActiveStores, setCatActiveStores] = useState([])
    const [catActiveTypes, setCatActiveTypes] = useState([])
    // Filters — checklist
    const [clActiveStores, setClActiveStores] = useState([])
    const [clActiveTypes, setClActiveTypes] = useState([])

    // ── Firestore subscriptions ──
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
            if (firstLoad) { firstLoad = false; if (data.length > 0) setViewMode('shop') }
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

    // ── Filter toggles ──
    const toggleFilter = (id, active, setActive) => {
        setActive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    // ── Filter logic ──
    const applyFilters = (items, activeStores, activeTypes, isChecklist = false) => {
        return items.filter(item => {
            const itemStores = isChecklist ? (item.stores || []) : (item.stores || [])
            const itemTypes = isChecklist ? (item.types || []) : (item.types || [])
            if (activeTypes.length > 0 && !activeTypes.some(t => itemTypes.includes(t))) return false
            if (activeStores.length > 0 && !activeStores.some(s => itemStores.includes(s))) return false
            return true
        })
    }

    const filteredProducts = applyFilters(products, catActiveStores, catActiveTypes)
    const filteredChecklist = applyFilters(checklist, clActiveStores, clActiveTypes, true)

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
        const data = { name: form.name.trim(), stores: form.stores, types: form.types, note: form.note.trim(), image: form.image.trim(), unit: form.unit === 'своя' ? form.unitCustom.trim() : form.unit }
        if (modal.mode === 'add') {
            await addDoc(collection(db, 'products'), { ...data, createdAt: Date.now() })
        } else {
            await updateDoc(doc(db, 'products', modal.product.id), data)
            // update checklist entry if exists
            const inList = checklist.find(c => c.productId === modal.product.id)
            if (inList) await updateDoc(doc(db, 'checklist', inList.id), { name: data.name, stores: data.stores, types: data.types })
        }
        setModal(null)
    }, [form, modal, checklist])

    // ── Modal helpers ──
    const openAdd = () => { setForm({ name: '', stores: [], types: [], note: '', image: '', unit: '', unitCustom: '' }); setModal({ mode: 'add' }) }
    const openEdit = (p) => { setForm({ name: p.name, stores: p.stores || [], types: p.types || [], note: p.note || '', image: p.image || '', unit: p.unit || '', unitCustom: p.unitCustom || '' }); setModal({ mode: 'edit', product: p }) }
    const openView = (p) => setModal({ mode: 'view', product: p })

    const toggleFormMulti = (field, id) => {
        setForm(f => ({ ...f, [field]: f[field].includes(id) ? f[field].filter(x => x !== id) : [...f[field], id] }))
    }

    // ── Menu items ──
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

    return (
        <>
            <style>{styles}</style>

            {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={menuItems(ctxMenu.product)} onClose={() => setCtxMenu(null)} />}
            {sheet && <BottomSheet title={sheet.product.name} items={menuItems(sheet.product)} onClose={() => setSheet(null)} />}
            {showSettings && <SettingsPanel stores={stores} types={types} onClose={() => setShowSettings(false)} />}

            <div className="app">
                <div className="header">
                    <h1>Закупки</h1>
                    <span className="header-sub">общий список</span>
                    <div className="header-right">
                        <button className={`toggle-btn ${viewMode === 'both' ? 'active' : ''}`} onClick={() => setViewMode('both')}>☰ Каталог</button>
                        <button className={`toggle-btn ${viewMode === 'shop' ? 'active' : ''}`} onClick={() => setViewMode('shop')}>🛒 Магазин</button>
                        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Настройки">⚙</button>
                    </div>
                </div>

                {viewMode === 'shop' ? (
                    <div className="shop-view">
                        <div className="column">
                            <div className="column-header">
                                <span className="column-title">Список покупок</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span className="column-count">{checklist.filter(c => !c.done).length} / {checklist.length}</span>
                                    {checklist.some(c => c.done) && <button className="chip" onClick={clearDone}>Очистить купленное</button>}
                                </div>
                            </div>
                            <FilterRows
                                stores={stores} types={types}
                                activeStores={clActiveStores} activeTypes={clActiveTypes}
                                onToggleStore={id => toggleFilter(id, clActiveStores, setClActiveStores)}
                                onToggleType={id => toggleFilter(id, clActiveTypes, setClActiveTypes)}
                            />
                            <div className="items-list" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                                {filteredChecklist.length === 0 && <div className="empty">{checklist.length === 0 ? 'Список пуст — добавьте товары в каталоге' : 'Ничего не найдено'}</div>}
                                {filteredChecklist.map(item => (
                                    <div key={item.id} className={`shop-checklist-item ${item.done ? 'done-item' : ''}`} onClick={() => toggleDone(item)}>
                                        <div className="shop-checkbox">{item.done && '✓'}</div>
                                        <div className="shop-item-body">
                                            <span className={`shop-item-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                                            {((item.types || []).length > 0 || (item.stores || []).length > 0) && (
                                                <div className="shop-item-tags">
                                                    {(item.types || []).map(id => { const t = types.find(x => x.id === id); return t ? <span key={id} className="shop-tag">{t.name}</span> : null })}
                                                    {(item.stores || []).map(id => { const s = stores.find(x => x.id === id); return s ? <span key={id} className="shop-tag">{s.name}</span> : null })}
                                                </div>
                                            )}
                                        </div>
                                        <QtyInput item={item} autoFocus={item.id === lastAddedId} />
                                        <button className="icon-btn" style={{ opacity: 0.3 }} onClick={e => { e.stopPropagation(); removeFromChecklist(item.id) }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="columns">
                        {/* CATALOG */}
                        <div className="column">
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
                        <div className="column">
                            <div className="column-header">
                                <span className="column-title">Список покупок</span>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span className="column-count">{checklist.filter(c => !c.done).length} / {checklist.length}</span>
                                    {checklist.some(c => c.done) && <button className="chip" onClick={clearDone}>Очистить</button>}
                                </div>
                            </div>
                            <FilterRows
                                stores={stores} types={types}
                                activeStores={clActiveStores} activeTypes={clActiveTypes}
                                onToggleStore={id => toggleFilter(id, clActiveStores, setClActiveStores)}
                                onToggleType={id => toggleFilter(id, clActiveTypes, setClActiveTypes)}
                            />
                            <div className="items-list">
                                {filteredChecklist.length === 0 && <div className="empty">{checklist.length === 0 ? 'Нажмите на продукт чтобы добавить' : 'Ничего не найдено'}</div>}
                                {filteredChecklist.map(item => (
                                    <div key={item.id} className="checklist-item" onClick={() => toggleDone(item)}>
                                        <input type="checkbox" checked={item.done} readOnly />
                                        <span className={`item-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                                        <div className="cl-tags">
                                            {(item.types || []).slice(0, 2).map(id => { const t = types.find(x => x.id === id); return t ? <span key={id} className="cl-tag">{t.name}</span> : null })}
                                            {(item.stores || []).slice(0, 1).map(id => { const s = stores.find(x => x.id === id); return s ? <span key={id} className="cl-tag">{s.name}</span> : null })}
                                        </div>
                                        <QtyInput item={item} autoFocus={item.id === lastAddedId} />
                                        <button className="cl-remove" onClick={e => { e.stopPropagation(); removeFromChecklist(item.id) }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
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
                                        ? <img className="modal-img" src={modal.product.image} alt={modal.product.name} />
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
                                        <div className="field-label">Ссылка на фото</div>
                                        <input className="field-input" value={form.image}
                                               onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                                               placeholder="https://..." />
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