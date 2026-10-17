import { useState, useEffect, useRef } from 'react'
import { API, type ClassItem, type Subject, type Student, type Lesson, type AttendanceRecord } from './api'
import { Watcher } from './components/Watcher'
import { Create } from './components/Create'
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Camera,
  LogOut,
  ChevronRight,
  Trash2,
  Check,
  CheckCircle2,
  X
} from 'lucide-react'

export default function App() {
  const [activeTab, setActiveTab] = useState<'classes' | 'subjects' | 'kiosk'>('classes')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null)
  const [classStudents, setClassStudents] = useState<Student[]>([])
  const [classLessons, setClassLessons] = useState<Lesson[]>([])
  const [openLessons, setOpenLessons] = useState<Lesson[]>([])
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])

  // modals
  const [modalType, setModalType] = useState<string | null>(null)
  const [newClassName, setNewClassName] = useState('')
  const [newClassSubjectId, setNewClassSubjectId] = useState<number | ''>('')
  const [newSubjectCode, setNewSubjectCode] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newStudentMssv, setNewStudentMssv] = useState('')
  const [newStudentName, setNewStudentName] = useState('')
  const [newLessonDate, setNewLessonDate] = useState(() => new Date().toISOString().split('T')[0])

  // kiosk camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const [lastDetected] = useState<string | null>(null)

  // load initial data
  const loadInitialData = async () => {
    try {
      const [cls, sub, openLes] = await Promise.all([
        API.listClasses().catch(() => []),
        API.listSubjects().catch(() => []),
        API.listOpenLessons().catch(() => [])
      ])
      setClasses(cls)
      setSubjects(sub)
      setOpenLessons(openLes)
      if (openLes.length > 0 && !selectedLesson) {
        setSelectedLesson(openLes[0])
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  // load class details
  const loadClassDetail = async (cls: ClassItem) => {
    setSelectedClass(cls)
    try {
      const [stus, less] = await Promise.all([
        API.listStudents(cls.id).catch(() => []),
        API.listLessonsByClass(cls.id).catch(() => [])
      ])
      setClassStudents(stus)
      setClassLessons(less)
    } catch (e) {
      console.error(e)
    }
  }

  // load lesson attendance
  const loadAttendance = async (lessonId: number) => {
    try {
      const records = await API.listAttendance(lessonId)
      setAttendanceRecords(records)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (selectedLesson) {
      loadAttendance(selectedLesson.id)
    }
  }, [selectedLesson])

  // camera kiosk stream
  useEffect(() => {
    let stream: MediaStream | null = null
    if (activeTab === 'kiosk') {
      navigator.mediaDevices?.getUserMedia({ video: { width: 1280, height: 720 } })
        .then((s) => {
          stream = s
          if (videoRef.current) {
            videoRef.current.srcObject = s
          }
        })
        .catch((err) => {
          console.warn('Camera error:', err)
        })
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const s = videoRef.current.srcObject as MediaStream
        s.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = null
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [activeTab])

  // create action dispatch from liquid create menu
  const handleCreateAction = (action: string) => {
    setModalType(action)
  }

  // submit class
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName || !newClassSubjectId) return
    try {
      await API.createClass(newClassName, Number(newClassSubjectId))
      setNewClassName('')
      setNewClassSubjectId('')
      setModalType(null)
      loadInitialData()
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo lớp')
    }
  }

  // submit subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubjectCode || !newSubjectName) return
    try {
      await API.createSubject(newSubjectCode, newSubjectName)
      setNewSubjectCode('')
      setNewSubjectName('')
      setModalType(null)
      loadInitialData()
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo môn')
    }
  }

  // submit student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClass || !newStudentMssv || !newStudentName) {
      alert('Vui lòng chọn lớp trước khi thêm sinh viên')
      return
    }
    try {
      await API.createStudent(selectedClass.id, newStudentMssv, newStudentName)
      setNewStudentMssv('')
      setNewStudentName('')
      setModalType(null)
      loadClassDetail(selectedClass)
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thêm sinh viên')
    }
  }

  // submit lesson
  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClass || !newLessonDate) {
      alert('Vui lòng chọn lớp học')
      return
    }
    try {
      await API.createLesson(selectedClass.id, newLessonDate)
      setModalType(null)
      loadClassDetail(selectedClass)
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo buổi học')
    }
  }

  return (
    <div className="min-h-screen bg-[#04060a] text-zinc-100 flex flex-col selection:bg-[#2a4690] selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 h-[56px] min-h-[56px] px-5 flex justify-between items-center bg-[#07090e]/85 backdrop-blur-xl border-b border-white/[0.08]">
        {/* Brand with interactive Watcher logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <Watcher size={32} shape="Cube" follow={65} />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-tight text-white flex items-center gap-1">
                <span>Face</span>
                <b className="text-[#9dbcff] font-bold">Attendance</b>
              </span>
              <span className="text-[9px] font-semibold text-[#9dbcff]/80 bg-[#2a4690]/25 px-1.5 py-0.5 rounded border border-[#9dbcff]/20 tracking-wider">
                REACT
              </span>
            </div>
          </div>
        </div>

        {/* Center Tabs */}
        <nav className="flex gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => { setActiveTab('classes'); setSelectedClass(null); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'classes'
                ? 'bg-[#2a4690] text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <GraduationCap size={13} />
            <span>Lớp học</span>
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'subjects'
                ? 'bg-[#2a4690] text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <BookOpen size={13} />
            <span>Môn học</span>
          </button>
          <button
            onClick={() => setActiveTab('kiosk')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'kiosk'
                ? 'bg-[#2a4690] text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Camera size={13} />
            <span>Camera Kiosk</span>
          </button>
        </nav>

        {/* Right Actions with Liquid Create Button */}
        <div className="flex items-center gap-2.5">
          <Create label="Tạo mới" onSelect={handleCreateAction} />
          <button
            onClick={() => API.logout().then(() => window.location.reload()).catch(() => {})}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 transition duration-150 cursor-pointer"
          >
            <LogOut size={12} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* VIEW 1: LỚP HỌC */}
        {activeTab === 'classes' && !selectedClass && (
          <div>
            {/* Bento Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
              <div className="bg-[#0a0d16]/80 border border-white/[0.08] backdrop-blur-xl rounded-[20px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_36px_-10px_rgba(0,0,0,0.6)]">
                <div className="text-3xl font-bold text-white tracking-tight leading-none">{classes.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mt-2">Tổng lớp học</div>
              </div>
              <div className="bg-[#0a0d16]/80 border border-white/[0.08] backdrop-blur-xl rounded-[20px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_36px_-10px_rgba(0,0,0,0.6)]">
                <div className="text-3xl font-bold text-white tracking-tight leading-none">{subjects.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mt-2">Môn học liên kết</div>
              </div>
              <div className="bg-[#0a0d16]/80 border border-white/[0.08] backdrop-blur-xl rounded-[20px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_36px_-10px_rgba(0,0,0,0.6)]">
                <div className="text-3xl font-bold text-emerald-400 tracking-tight leading-none">{openLessons.length}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mt-2">Buổi học đang mở</div>
              </div>
            </div>

            {/* Classes Grid */}
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-sm font-semibold text-white tracking-tight">Danh sách lớp học</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classes.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => loadClassDetail(cls)}
                  className="group bg-[#0a0d16]/80 hover:bg-[#0f1422] border border-white/[0.08] hover:border-[#9dbcff]/30 rounded-[18px] p-5 cursor-pointer transition-all duration-200 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9dbcff] bg-[#2a4690]/25 px-2 py-0.5 rounded border border-[#9dbcff]/20">
                        {cls.mon_hoc?.ma_mon || 'MÔN HỌC'}
                      </span>
                      <h3 className="text-base font-semibold text-white mt-2 group-hover:text-[#9dbcff] transition">
                        {cls.ten}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">{cls.mon_hoc?.ten || 'Chưa gắn môn'}</p>
                    </div>
                    <ChevronRight size={18} className="text-zinc-500 group-hover:text-white transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 1.1: CHI TIẾT LỚP HỌC */}
        {activeTab === 'classes' && selectedClass && (
          <div>
            <div className="flex items-center gap-2 mb-6 text-xs text-zinc-400">
              <button
                onClick={() => setSelectedClass(null)}
                className="hover:text-white underline cursor-pointer"
              >
                Lớp học
              </button>
              <span>/</span>
              <span className="text-white font-semibold">{selectedClass.ten}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sinh viên */}
              <div className="bg-[#0a0d16]/80 border border-white/[0.08] rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users size={16} className="text-[#9dbcff]" />
                    <span>Danh sách sinh viên ({classStudents.length})</span>
                  </h3>
                  <button
                    onClick={() => setModalType('create-student')}
                    className="text-xs text-[#9dbcff] hover:underline"
                  >
                    + Thêm sinh viên
                  </button>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {classStudents.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#1c1d22] text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{st.ho_ten}</div>
                        <div className="text-[11px] text-zinc-400">{st.mssv}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {st.has_face ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Đã có khuôn mặt</span>
                        ) : (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Chưa có khuôn mặt</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {classStudents.length === 0 && (
                    <div className="text-center py-8 text-zinc-500 text-xs">Chưa có sinh viên trong lớp này</div>
                  )}
                </div>
              </div>

              {/* Buổi học */}
              <div className="bg-[#0a0d16]/80 border border-white/[0.08] rounded-[20px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Calendar size={16} className="text-[#9dbcff]" />
                    <span>Lịch sử buổi học</span>
                  </h3>
                  <button
                    onClick={() => setModalType('create-lesson')}
                    className="text-xs text-[#9dbcff] hover:underline"
                  >
                    + Tạo buổi học
                  </button>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {classLessons.map((les) => (
                    <div
                      key={les.id}
                      onClick={() => { setSelectedLesson(les); setActiveTab('kiosk'); }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] cursor-pointer text-xs transition"
                    >
                      <div>
                        <div className="font-semibold text-white">Buổi ngày {les.ngay}</div>
                        <div className="text-[11px] text-zinc-400">
                          {les.bat_dau ? `${les.bat_dau} - ${les.ket_thuc || '...'}` : 'Chưa điểm danh'}
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        les.trang_thai === 'mo' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-500/20 text-zinc-400'
                      }`}>
                        {les.trang_thai === 'mo' ? 'Đang mở' : 'Đã đóng'}
                      </span>
                    </div>
                  ))}
                  {classLessons.length === 0 && (
                    <div className="text-center py-8 text-zinc-500 text-xs">Chưa có buổi học nào</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MÔN HỌC */}
        {activeTab === 'subjects' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Quản lý môn học</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subjects.map((sub) => (
                <div key={sub.id} className="bg-[#0a0d16]/80 border border-white/[0.08] rounded-[18px] p-5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-[#9dbcff] bg-[#2a4690]/20 px-2 py-0.5 rounded border border-[#9dbcff]/20">
                      {sub.ma_mon}
                    </span>
                    <h3 className="text-base font-semibold text-white mt-2">{sub.ten}</h3>
                  </div>
                  <button
                    onClick={() => API.deleteSubject(sub.id).then(() => loadInitialData())}
                    className="p-2 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: CAMERA KIOSK */}
        {activeTab === 'kiosk' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Camera Stage */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="relative aspect-video bg-[#07090e] rounded-[24px] overflow-hidden border border-white/[0.08] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.85)] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Apple-style intelligent camera glow overlay */}
                <div className="absolute inset-0 pointer-events-none rounded-[24px] shadow-[inset_0_0_40px_rgba(59,130,246,0.3)] border border-[#9dbcff]/30" />

                {/* Status indicator */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-[#0a0d16]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-medium text-white">Camera AI trực tiếp</span>
                </div>

                {lastDetected && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2 shadow-lg">
                    <CheckCircle2 size={16} />
                    <span>Đã nhận diện: {lastDetected}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Live Feed */}
            <div className="bg-[#0a0d16]/80 border border-white/[0.08] rounded-[24px] p-5 flex flex-col h-[520px]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Điểm danh trực tiếp</h3>
                  <p className="text-[11px] text-zinc-400">{selectedLesson ? `Buổi ngày ${selectedLesson.ngay}` : 'Chưa chọn buổi học'}</p>
                </div>
                <span className="text-xs font-bold text-[#9dbcff] bg-[#2a4690]/25 px-2.5 py-1 rounded-full border border-[#9dbcff]/20">
                  {attendanceRecords.length} có mặt
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {attendanceRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#1c1d22] text-xs transition"
                  >
                    <div>
                      <div className="font-semibold text-white">{rec.sinh_vien?.ho_ten || 'Sinh viên'}</div>
                      <div className="text-[11px] text-zinc-400">{rec.sinh_vien?.mssv || `ID: ${rec.sinh_vien_id}`}</div>
                    </div>
                    <div className="text-emerald-400">
                      <Check size={16} />
                    </div>
                  </div>
                ))}
                {attendanceRecords.length === 0 && (
                  <div className="text-center py-12 text-zinc-500 text-xs">
                    Chưa có lượt điểm danh nào trong buổi này
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0a0d16] border border-white/10 rounded-[24px] max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setModalType(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>

            {modalType === 'create-class' && (
              <form onSubmit={handleCreateClass}>
                <h3 className="text-sm font-semibold text-white mb-4">Tạo lớp học mới</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-zinc-400 mb-1 block">Tên lớp</label>
                    <input
                      type="text"
                      required
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="VD: D21CQCN01-N"
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs outline-none focus:border-[#9dbcff]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 mb-1 block">Môn học</label>
                    <select
                      required
                      value={newClassSubjectId}
                      onChange={(e) => setNewClassSubjectId(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0a0d16] border border-white/10 rounded-lg text-white text-xs outline-none focus:border-[#9dbcff]/50"
                    >
                      <option value="">Chọn môn học</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.ma_mon} - {s.ten}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] hover:bg-white/10 text-zinc-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2a4690] hover:bg-[#385bbb] text-white"
                  >
                    Tạo lớp
                  </button>
                </div>
              </form>
            )}

            {modalType === 'create-subject' && (
              <form onSubmit={handleCreateSubject}>
                <h3 className="text-sm font-semibold text-white mb-4">Tạo môn học mới</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-zinc-400 mb-1 block">Mã môn học</label>
                    <input
                      type="text"
                      required
                      value={newSubjectCode}
                      onChange={(e) => setNewSubjectCode(e.target.value)}
                      placeholder="VD: INT1434"
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs outline-none focus:border-[#9dbcff]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 mb-1 block">Tên môn học</label>
                    <input
                      type="text"
                      required
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="VD: Trí tuệ nhân tạo"
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs outline-none focus:border-[#9dbcff]/50"
                    />
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] hover:bg-white/10 text-zinc-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2a4690] hover:bg-[#385bbb] text-white"
                  >
                    Tạo môn
                  </button>
                </div>
              </form>
            )}

            {modalType === 'create-student' && (
              <form onSubmit={handleCreateStudent}>
                <h3 className="text-sm font-semibold text-white mb-4">Thêm sinh viên vào lớp</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-zinc-400 mb-1 block">Mã số sinh viên (MSSV)</label>
                    <input
                      type="text"
                      required
                      value={newStudentMssv}
                      onChange={(e) => setNewStudentMssv(e.target.value)}
                      placeholder="VD: B21DCCN001"
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs outline-none focus:border-[#9dbcff]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 mb-1 block">Họ và tên</label>
                    <input
                      type="text"
                      required
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="VD: Nguyễn Văn A"
                      className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs outline-none focus:border-[#9dbcff]/50"
                    />
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] hover:bg-white/10 text-zinc-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2a4690] hover:bg-[#385bbb] text-white"
                  >
                    Thêm sinh viên
                  </button>
                </div>
              </form>
            )}

            {modalType === 'create-lesson' && (
              <form onSubmit={handleCreateLesson}>
                <h3 className="text-sm font-semibold text-white mb-4">Tạo buổi học mới</h3>
                <div>
                  <label className="text-[11px] text-zinc-400 mb-1 block">Ngày diễn ra</label>
                  <input
                    type="date"
                    required
                    value={newLessonDate}
                    onChange={(e) => setNewLessonDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-white text-xs outline-none focus:border-[#9dbcff]/50"
                  />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalType(null)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] hover:bg-white/10 text-zinc-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2a4690] hover:bg-[#385bbb] text-white"
                  >
                    Tạo buổi học
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
