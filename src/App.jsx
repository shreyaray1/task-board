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

const MEMBER_COLORS = ['#6c63ff', '#e53935', '#2e7d32', '#1565c0', '#e65100', '#6a1b9a']

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ member, size = 28 }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: member.color,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.4,
      fontWeight: 700,
      flexShrink: 0,
    }}>
      {member.name.charAt(0).toUpperCase()}
    </div>
  )
}

function TaskCard({ task, onDelete, onOpen, teamMembers }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const assignee = teamMembers.find(m => m.id === task.assignee_id)

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
        {assignee && <Avatar member={assignee} />}
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

function Column({ column, tasks, onAddTask, onDelete, onOpen, teamMembers }) {
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
            <TaskCard key={task.id} task={task} onDelete={onDelete} onOpen={onOpen} teamMembers={teamMembers} />
          ))}
        </div>
      </SortableContext>
      <button className="add-task-btn" onClick={() => onAddTask(column.id)}>
        + Add Task
      </button>
    </div>
  )
}

function TaskDetailPanel({ task, onClose, onDelete, teamMembers }) {
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
  const assignee = teamMembers.find(m => m.id === task.assignee_id)

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
          {assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Avatar member={assignee} />
              <span style={{ fontSize: '13px', color: '#8b8fa8' }}>{assignee.name}</span>
            </div>
          )}
        </div>

        {task.labels && task.labels.length > 0 && (
          <div className="labels" style={{ marginBottom: '8px' }}>
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
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal', due_date: '', labels: [], assignee_id: '' })
  const [targetColumn, setTargetColumn] = useState('todo')
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState(MEMBER_COLORS[0])

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
    fetchTeamMembers()
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

  async function fetchTeamMembers() {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error) setTeamMembers(data)
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
      assignee_id: newTask.assignee_id || null,
    }).select()
    if (!error) {
      setTasks(prev => [...prev, ...data])
      setNewTask({ title: '', description: '', priority: 'normal', due_date: '', labels: [], assignee_id: '' })
      setShowModal(false)
    }
  }

  async function addTeamMember() {
    if (!newMemberName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('team_members').insert({
      name: newMemberName,
      color: newMemberColor,
      user_id: user.id,
    }).select()
    if (!error) {
      setTeamMembers(prev => [...prev, ...data])
      setNewMemberName('')
      setNewMemberColor(MEMBER_COLORS[0])
    }
  }

  async function deleteTeamMember(memberId) {
    setTeamMembers(prev => prev.filter(m => m.id !== memberId))
    await supabase.from('team_members').delete().eq('id', memberId)
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
        <div className="header-left">
          <h1>Task Board</h1>
          <p className="subtitle">Manage your work visually</p>
        </div>
        <div className="header-right">
          <div className="team-avatars">
            {teamMembers.map(m => (
              <div key={m.id} title={m.name} style={{ marginLeft: '-6px' }}>
                <Avatar member={m} />
              </div>
            ))}
          </div>
          <button className="btn-team" onClick={() => setShowTeamModal(true)}>
            Manage Team
          </button>
        </div>
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
              teamMembers={teamMembers}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onDelete={deleteTask} onOpen={() => {}} teamMembers={teamMembers} />}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={deleteTask}
          teamMembers={teamMembers}
        />
      )}

      {showTeamModal && (
        <div className="modal-overlay" onClick={() => setShowTeamModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Manage Team</h2>
            <div className="team-list">
              {teamMembers.length === 0 && (
                <p style={{ color: '#8b8fa8', fontSize: '13px' }}>No team members yet</p>
              )}
              {teamMembers.map(member => (
                <div key={member.id} className="team-member-row">
                  <Avatar member={member} />
                  <span className="member-name">{member.name}</span>
                  <button className="delete-btn" onClick={() => deleteTeamMember(member.id)}>×</button>
                </div>
              ))}
            </div>
            <div className="add-member-row">
              <input
                className="input"
                placeholder="Member name"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTeamMember()}
              />
              <div className="color-options">
                {MEMBER_COLORS.map(color => (
                  <button
                    key={color}
                    className="color-btn"
                    style={{
                      background: color,
                      border: newMemberColor === color ? '2px solid #1a1a2e' : '2px solid transparent'
                    }}
                    onClick={() => setNewMemberColor(color)}
                  />
                ))}
              </div>
              <button className="btn-add" onClick={addTeamMember}>Add</button>
            </div>
            <button className="btn-cancel" onClick={() => setShowTeamModal(false)}>Done</button>
          </div>
        </div>
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
            {teamMembers.length > 0 && (
              <select
                className="input"
                value={newTask.assignee_id}
                onChange={e => setNewTask(prev => ({ ...prev, assignee_id: e.target.value }))}
              >
                <option value="">No assignee</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
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