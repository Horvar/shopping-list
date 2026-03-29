import { useState, useEffect } from 'react'
import { db } from './firebase'
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore'

function App() {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const addItem = async () => {
    if (!input.trim()) return
    await addDoc(collection(db, 'items'), {
      name: input.trim(),
      done: false,
      createdAt: Date.now()
    })
    setInput('')
  }

  const toggleItem = async (id, done) => {
    await updateDoc(doc(db, 'items', id), { done: !done })
  }

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, 'items', id))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addItem()
  }

  return (
      <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px' }}>
        <h1>Список покупок</h1>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Добавить товар..."
              style={{ flex: 1, padding: '8px 12px', fontSize: 16 }}
          />
          <button onClick={addItem} style={{ padding: '8px 16px', fontSize: 16 }}>
            Добавить
          </button>
        </div>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {items.map(item => (
              <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8
                  }}
              >
                <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleItem(item.id, item.done)}
                />
                <span style={{
                  flex: 1,
                  textDecoration: item.done ? 'line-through' : 'none',
                  opacity: item.done ? 0.5 : 1
                }}>
              {item.name}
            </span>
                <button onClick={() => deleteItem(item.id)}>✕</button>
              </li>
          ))}
        </ul>
      </div>
  )
}

export default App