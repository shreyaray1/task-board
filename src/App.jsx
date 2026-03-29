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

const LABEL_COLORS = {
  Bug: { bg: '#fdecea', color: '#c62828' },
  Feature: { bg: '#e8f5e9', color: '#2e7d32' },
  Design: { bg: '#e3f2fd', color: '#1565c0' },
  Research: { bg: '#f3e5f5', color: '#6a1b9a' },
  Urgent: { bg: '#fff3e0', color: '#e65100' },
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function TaskCard({ task, onDelete, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="task-card" onClick={() => onOpen(task)}>
      <div className="task-card-header">
        <p className="task-title">{task.title}</p>
        <button className="delete-btn" onClick={(e) => {
          e.stopPropagation()
          onDelete(task.id)
        }}>×</button>
      </div>
      {task.description && <p className="task-desc">{task.description}</p>}
      <div className="task-footer">
        {task.priority && (
          <span className={`priority priority-${task.priority}`}>
            {task.priority}
          </span>
        )}
        {task.due_date && (
          <p className="due-date">Due: {task.due_date}</p>
        )}
      </div>
      {task.labels && task.labels.length > 0 && (
        <div className="labels">
          {task.labels.map(label => (
            <span key={label} className="label" style={{
              background: LABEL_COLORS[label]?.bg || '#f0f1f5',
              color: LABEL_COLORS[label]?.color || '#8b8fa8'
            }}>
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Column({ column, tasks, onAddTask, onDelete, onOpen }) {
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
            <TaskCard key={task.id} task={task} onDelete={onDelete} onOpen={onOpen} />
          ))}
        </div>
      </SortableContext>
      <button className="add-task-btn" onClick={() => onAddTask(column.id)}>
        + Add Task
      </button>
    </div>
  )
}

function TaskDetailPanel({ task, onClose, onDelete }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loadingComments, setLoadingComments] = useState(true)

  useEffect(() => {
    fetchComments()
  }, [task.id])

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', task.id)
      .order('created_at', { ascending: true })
    if (!error) setComments(data)
    setLoadingComments(false)
  }

  async function addComment() {
    if (!newComment.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('comments').insert({
      task_id: task.id,
      user_id: user.id,
      content: newComment,
    }).select()
    if (!error) {
      setComments(prev => [...prev, ...data])
      setNewComment('')
    }
  }

  async function deleteComment(commentId) {
    setComments(prev => prev.filter(c => c.id !== commentId))
    await supabase.from('comments').delete().eq('id', commentId)
  }

  const columnLabel = COLUMNS.find(c => c.id === task.status)?.label

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={e => e.stopPropagation()}>
        <div className="detail-header">
          <div>
            <span className="detail-status">{columnLabel}</span>
            <h2 className="detail-title">{task.title}</h2>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {task.description && (
          <p className="detail-desc">{task.description}</p>
        )}

        <div className="detail-meta">
          {task.priority && (
            <span className={`priority priority-${task.priority}`}>{task.priority}</span>
          )}
          {task.due_date && (
            <span className="due-date">Due: {task.due_date}</span>
          )}
        </div>

        {task.labels && task.labels.length > 0 && (
          <div className="labels" style={{ marginBottom: '20px' }}>
            {task.labels.map(label => (
              <span key={label} className="label" style={{
                background: LABEL_COLORS[label]?.bg || '#f0f1f5',
                color: LABEL_COLORS[label]?.color || '#8b8fa8'
              }}>
                {label}
              </span>
            ))}
          </div>
        )}

        <div className="comments-section">
          <h3 className="comments-title">Comments</h3>
          {loadingComments ? (
            <p className="comments-loading">Loading comments...</p>
          ) : comments.length === 0 ? (
            <p className="no-comments">No comments yet. Be the first!</p>
          ) : (
            <div className="comments-list">
              {comments.map(comment => (
                <div key={comment.id} className="comment">
                  <div className="comment-header">
                    <span className="comment-time">{formatDate(comment.created_at)}</span>
                    <button className="delete-btn" onClick={() => deleteComment(comment.id)}>×</button>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              ))}
            </div>
          )}

          <div className="comment-input-area">
            <textarea
              className="input comment-input"
              placeholder="Write a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addComment()
                }
              }}
            />
            <button className="btn-add" onClick={addComment}>Post</button>
          </div>
        </div>

        <button className="delete-task-btn" onClick={() => {
          onDelete(task.id)
          onClose()
        }}>
          Delete Task
        </button>
      </div>
    </div>
  )
}

function App() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal', due_date: '', labels: [] })
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
      labels: newTask.labels,
    }).select()
    if (!error) {
      setTasks(prev => [...prev, ...data])
      setNewTask({ title: '', description: '', priority: 'normal', due_date: '', labels: [] })
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

  function toggleLabel(label) {
    setNewTask(prev => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels.filter(l => l !== label)
        : [...prev.labels, label]
    }))
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
              onOpen={setSelectedTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onDelete={deleteTask} onOpen={() => {}} />}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={deleteTask}
        />
      )}

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
            <div className="label-section">
              <p className="label-title">Labels</p>
              <div className="label-options">
                {Object.keys(LABEL_COLORS).map(label => (
                  <button
                    key={label}
                    className={`label-option ${newTask.labels.includes(label) ? 'selected' : ''}`}
                    style={{
                      background: newTask.labels.includes(label) ? LABEL_COLORS[label].bg : 'white',
                      color: newTask.labels.includes(label) ? LABEL_COLORS[label].color : '#8b8fa8',
                      borderColor: newTask.labels.includes(label) ? LABEL_COLORS[label].color : '#e8eaed',
                    }}
                    onClick={() => toggleLabel(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
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