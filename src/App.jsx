import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
]

function TaskCard({ task, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="task-card">
      <div className="task-card-header">
        <p className="task-title">{task.title}</p>
        <button className="delete-btn" onClick={(e) => {
          e.stopPropagation()
          onDelete(task.id)
        }}>×</button>
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}
      {task.priority && (
        <span className={`priority priority-${task.priority}`}>
          {task.priority}
        </span>
      )}
      {task.due_date && (
        <p className="due-date">Due: {task.due_date}</p>
      )}
    </div>
  )
}

function Column({ column, tasks, onAddTask, onDelete }) {
  const { setNodeRef } = useDroppable({ id: column.id })

  return (
    <div className="column">
      <div className="column-header">
        <h2>{column.label}</h2>
        <span className="task-count">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="task-list" ref={setNodeRef} style={{ minHeight: '80px' }}>
          {tasks.length === 0 && (
            <div className="empty-state">No tasks yet</div>
          )}
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
      <button className="add-task-btn" onClick={() => onAddTask(column.id)}>
        + Add Task
      </button>
    </div>
  )
}

function App() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal', due_date: '' })
  const [targetColumn, setTargetColumn] = useState('todo')

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }))

  useEffect(() => {
    setupUser()
  }, [])

  async function setupUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      await supabase.auth.signInAnonymously()
    }
    fetchTasks()
  }

  async function fetchTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) console.error(error)
    else setTasks(data)
    setLoading(false)
  }

  async function addTask() {
    if (!newTask.title.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('tasks').insert({
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      due_date: newTask.due_date || null,
      status: targetColumn,
      user_id: user.id,
    }).select()
    if (!error) {
      setTasks(prev => [...prev, ...data])
      setNewTask({ title: '', description: '', priority: 'normal', due_date: '' })
      setShowModal(false)
    }
  }

  async function deleteTask(taskId) {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await supabase.from('tasks').delete().eq('id', taskId)
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const taskId = active.id
    const overId = over.id

    let newStatus = COLUMNS.find(c => c.id === overId)?.id

    if (!newStatus) {
      const overTask = tasks.find(t => t.id === overId)
      if (overTask) newStatus = overTask.status
    }

    if (!newStatus) return

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
  }

  function handleDragStart(event) {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task)
  }

  function openModal(columnId) {
    setTargetColumn(columnId)
    setShowModal(true)
  }

  if (loading) return <div className="loading">Loading your board...</div>

  return (
    <div className="app">
      <header className="header">
        <h1>Task Board</h1>
        <p className="subtitle">Manage your work visually</p>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="board">
          {COLUMNS.map(column => (
            <Column
              key={column.id}
              column={column}
              tasks={tasks.filter(t => t.status === column.id)}
              onAddTask={openModal}
              onDelete={deleteTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} />}
        </DragOverlay>
      </DndContext>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add New Task</h2>
            <input
              className="input"
              placeholder="Task title *"
              value={newTask.title}
              onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            />
            <textarea
              className="input"
              placeholder="Description (optional)"
              value={newTask.description}
              onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
            />
            <select
              className="input"
              value={newTask.priority}
              onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
            </select>
            <input
              className="input"
              type="date"
              value={newTask.due_date}
              onChange={e => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
            />
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-add" onClick={addTask}>Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App