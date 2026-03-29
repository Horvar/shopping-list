import { useState, useEffect } from 'react'
import { db } from './firebase'
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, onSnapshot, query, orderBy
} from 'firebase/firestore'

const CATEGORIES = ['Все', 'Еда', 'Бытовое', 'Косметика', 'Другое']

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
    align-items: baseline;
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

  .header span {
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 300;
  }

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
  }

  .column-header {
    padding: 20px 20px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
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
    padding: 12px 20px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
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
  }

  .filter-btn:hover { border-color: var(--accent); color: var(--accent); }
  .filter-btn.active { background: var(--accent); color: #000; border-color: var(--accent); }

  .items-list {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: calc(100vh - 280px);
    overflow-y: auto;
  }

  .items-list::-webkit-scrollbar { width: 4px; }
  .items-list::-webkit-scrollbar-track { background: transparent; }
  .items-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface2);
    border: 1px solid transparent;
    transition: border-color 0.15s;
  }

  .item:hover { border-color: var(--border); }

  .item-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 400;
  }

  .item-name.done {
    text-decoration: line-through;
    color: var(--muted);
  }

  .item-category {
    font-size: 0.65rem;
    color: var(--muted);
    background: var(--surface);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .item-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .item:hover .item-actions { opacity: 1; }

  .icon-btn {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    transition: all 0.15s;
  }

  .icon-btn:hover { background: var(--surface); color: var(--text); }
  .icon-btn.add:hover { border-color: var(--accent); color: var(--accent); }
  .icon-btn.info:hover { border-color: var(--accent2); color: var(--accent2); }
  .icon-btn.del:hover { border-color: var(--danger); color: var(--danger); }

  .checklist-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface2);
    border: 1px solid transparent;
    transition: border-color 0.15s;
  }

  .checklist-item:hover { border-color: var(--border); }

  .checklist-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
    flex-shrink: 0;
  }

  .add-form {
    padding: 16px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 8px;
  }

  .add-input {
    flex: 1;
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

  .add-input:focus { border-color: var(--accent); }
  .add-input::placeholder { color: var(--muted); }

  .add-btn {
    background: var(--accent);
    color: #000;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-family: 'Syne', sans-serif;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .add-btn:hover { opacity: 0.85; }

  /* Modal */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 24px;
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
    background: var(--surface2);
  }

  .modal-img-placeholder {
    width: 100%;
    height: 180px;
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

  textarea.field-input {
    resize: vertical;
    min-height: 80px;
    font-family: 'Inter', sans-serif;
  }

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

  .empty {
    padding: 32px 20px;
    text-align: center;
    color: var(--muted);
    font-size: 0.8rem;
  }

  @media (max-width: 700px) {
    .columns { grid-template-columns: 1fr; }
  }
`

export default function App() {
  const [products, setProducts] = useState([])
  const [checklist, setChecklist] = useState([])
  const [filter, setFilter] = useState('Все')
  const [modal, setModal] = useState(null) // { mode: 'view'|'add'|'edit', product? }
  const [form, setForm] = useState({ name: '', category: 'Еда', note: '', image: '' })
  const [addInput, setAddInput] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'checklist'), orderBy('addedAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setChecklist(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const openAdd = () => {
    setForm({ name: '', category: 'Еда', note: '', image: '' })
    setModal({ mode: 'add' })
  }

  const openEdit = (product) => {
    setForm({ name: product.name, category: product.category || 'Еда', note: product.note || '', image: product.image || '' })
    setModal({ mode: 'edit', product })
  }

  const openView = (product) => {
    setModal({ mode: 'view', product })
  }

  const closeModal = () => setModal(null)

  const saveProduct = async () => {
    if (!form.name.trim()) return
    if (modal.mode === 'add') {
      await addDoc(collection(db, 'products'), {
        name: form.name.trim(),
        category: form.category,
        note: form.note.trim(),
        image: form.image.trim(),
        createdAt: Date.now()
      })
    } else {
      await updateDoc(doc(db, 'products', modal.product.id), {
        name: form.name.trim(),
        category: form.category,
        note: form.note.trim(),
        image: form.image.trim(),
      })
    }
    closeModal()
  }

  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, 'products', id))
    // also remove from checklist if present
    const inList = checklist.find(c => c.productId === id)
    if (inList) await deleteDoc(doc(db, 'checklist', inList.id))
  }

  const addToChecklist = async (product) => {
    const already = checklist.find(c => c.productId === product.id)
    if (already) return
    await addDoc(collection(db, 'checklist'), {
      productId: product.id,
      name: product.name,
      done: false,
      addedAt: Date.now()
    })
  }

  const toggleChecklist = async (item) => {
    await updateDoc(doc(db, 'checklist', item.id), { done: !item.done })
  }

  const removeFromChecklist = async (id) => {
    await deleteDoc(doc(db, 'checklist', id))
  }

  const clearDone = async () => {
    const done = checklist.filter(c => c.done)
    await Promise.all(done.map(c => deleteDoc(doc(db, 'checklist', c.id))))
  }

  const filtered = filter === 'Все' ? products : products.filter(p => p.category === filter)

  const inChecklist = (id) => checklist.some(c => c.productId === id)

  return (
      <>
        <style>{styles}</style>
        <div className="app">
          <div className="header">
            <h1>Закупки</h1>
            <span>общий список</span>
          </div>

          <div className="columns">
            {/* CATALOG */}
            <div className="column">
              <div className="column-header">
                <span className="column-title">Каталог</span>
                <span className="column-count">{filtered.length}</span>
              </div>

              <div className="filters">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`filter-btn ${filter === cat ? 'active' : ''}`}
                        onClick={() => setFilter(cat)}
                    >
                      {cat}
                    </button>
                ))}
              </div>

              <div className="items-list">
                {filtered.length === 0 && <div className="empty">Пусто</div>}
                {filtered.map(product => (
                    <div className="item" key={product.id}>
                      <span className="item-name">{product.name}</span>
                      {product.category && <span className="item-category">{product.category}</span>}
                      <div className="item-actions">
                        <button className="icon-btn info" onClick={() => openView(product)} title="Инфо">ℹ</button>
                        <button className="icon-btn" onClick={() => openEdit(product)} title="Редактировать">✎</button>
                        <button
                            className="icon-btn add"
                            onClick={() => addToChecklist(product)}
                            title="В список"
                            style={inChecklist(product.id) ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                        >
                          {inChecklist(product.id) ? '✓' : '+'}
                        </button>
                        <button className="icon-btn del" onClick={() => deleteProduct(product.id)} title="Удалить">✕</button>
                      </div>
                    </div>
                ))}
              </div>

              <div className="add-form">
                <button className="add-btn" onClick={openAdd}>+ Добавить</button>
              </div>
            </div>

            {/* CHECKLIST */}
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
                {checklist.length === 0 && <div className="empty">Добавьте товары из каталога</div>}
                {checklist.map(item => (
                    <div className="checklist-item" key={item.id}>
                      <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => toggleChecklist(item)}
                      />
                      <span className={`item-name ${item.done ? 'done' : ''}`}>{item.name}</span>
                      <div className="item-actions" style={{ opacity: 1 }}>
                        <button className="icon-btn del" onClick={() => removeFromChecklist(item.id)}>✕</button>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MODAL */}
        {modal && (
            <div className="overlay" onClick={closeModal}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
              <span className="modal-title">
                {modal.mode === 'view' ? modal.product.name : modal.mode === 'add' ? 'Новый продукт' : 'Редактировать'}
              </span>
                  <button className="icon-btn" onClick={closeModal}>✕</button>
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
                          <input
                              className="field-input"
                              value={form.name}
                              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                              placeholder="Молоко, хлеб..."
                              onKeyDown={e => e.key === 'Enter' && saveProduct()}
                          />
                        </div>
                        <div>
                          <div className="field-label">Категория</div>
                          <select
                              className="field-input"
                              value={form.category}
                              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                          >
                            {CATEGORIES.filter(c => c !== 'Все').map(c => (
                                <option key={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="field-label">Ссылка на фото (URL)</div>
                          <input
                              className="field-input"
                              value={form.image}
                              onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                              placeholder="https://..."
                          />
                        </div>
                        <div>
                          <div className="field-label">Заметка</div>
                          <textarea
                              className="field-input"
                              value={form.note}
                              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                              placeholder="Бренд, магазин, детали..."
                          />
                        </div>
                      </>
                  )}
                </div>

                <div className="modal-footer">
                  {modal.mode === 'view' ? (
                      <>
                        <button className="btn-secondary" onClick={() => openEdit(modal.product)}>Редактировать</button>
                        <button className="btn-primary" onClick={() => { addToChecklist(modal.product); closeModal() }}>
                          {inChecklist(modal.product.id) ? 'Уже в списке' : '+ В список'}
                        </button>
                      </>
                  ) : (
                      <>
                        <button className="btn-secondary" onClick={closeModal}>Отмена</button>
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