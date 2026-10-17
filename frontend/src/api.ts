// api client for face attendance system

export interface Subject {
  id: number
  ma_mon: string
  ten: string
}

export interface ClassItem {
  id: number
  ten: string
  mon_hoc_id: number
  mon_hoc?: Subject
  total_students?: number
}

export interface Student {
  id: number
  mssv: string
  ho_ten: string
  has_face?: boolean
  created_at?: string
}

export interface Lesson {
  id: number
  lop_hoc_id: number
  ngay: string
  bat_dau?: string
  ket_thuc?: string
  trang_thai: 'mo' | 'dong'
  lop_hoc?: ClassItem
}

export interface AttendanceRecord {
  id: number
  buoi_hoc_id: number
  sinh_vien_id: number
  thoi_gian: string
  phuong_thuc: 'camera' | 'manual'
  sinh_vien?: Student
}

export const API = {
  async request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    try {
      const resp = await fetch(url, options)
      const data = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        const errorMsg = data.message || data.error || `HTTP error ${resp.status}`
        const err = new Error(errorMsg)
        ;(err as any).status = resp.status
        ;(err as any).data = data
        throw err
      }
      return data
    } catch (err) {
      console.error(`API Error on ${url}:`, err)
      throw err
    }
  },

  async login(loginCode: string) {
    return this.request<{ success: boolean; ho_ten?: string }>('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login_code: loginCode }),
    })
  },

  async logout() {
    return this.request('/logout', { method: 'POST' })
  },

  async listSubjects(): Promise<Subject[]> {
    const res = await this.request('/protected/mon-hoc')
    return Array.isArray(res) ? res : res.data || []
  },

  async createSubject(maMon: string, ten: string) {
    return this.request('/protected/mon-hoc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ma_mon: maMon, ten }),
    })
  },

  async deleteSubject(id: number) {
    return this.request(`/protected/mon-hoc/${id}`, { method: 'DELETE' })
  },

  async listClasses(): Promise<ClassItem[]> {
    const res = await this.request('/protected/lop-hoc')
    return Array.isArray(res) ? res : res.data || []
  },

  async createClass(ten: string, monHocID: number) {
    return this.request('/protected/lop-hoc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ten, mon_hoc_id: Number(monHocID) }),
    })
  },

  async deleteClass(id: number) {
    return this.request(`/protected/lop-hoc/${id}`, { method: 'DELETE' })
  },

  async listStudents(classID: number): Promise<Student[]> {
    const res = await this.request(`/protected/lop-hoc/${classID}/sinh-vien`)
    return Array.isArray(res) ? res : res.data || []
  },

  async createStudent(classID: number, mssv: string, hoTen: string) {
    return this.request(`/protected/lop-hoc/${classID}/sinh-vien`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mssv, ho_ten: hoTen }),
    })
  },

  async deleteStudent(id: number) {
    return this.request(`/protected/sinh-vien/${id}`, { method: 'DELETE' })
  },

  async listLessonsByClass(classID: number): Promise<Lesson[]> {
    const res = await this.request(`/protected/lop-hoc/${classID}/buoi-hoc`)
    return Array.isArray(res) ? res : res.data || []
  },

  async listOpenLessons(): Promise<Lesson[]> {
    const res = await this.request('/buoi-hoc/open')
    return Array.isArray(res) ? res : res.data || []
  },

  async createLesson(classID: number, ngay: string, batDau?: string, ketThuc?: string) {
    return this.request(`/protected/lop-hoc/${classID}/buoi-hoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ngay,
        bat_dau: batDau || null,
        ket_thuc: ketThuc || null,
      }),
    })
  },

  async updateLessonStatus(id: number, status: 'mo' | 'dong') {
    return this.request(`/protected/buoi-hoc/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trang_thai: status }),
    })
  },

  async listAttendance(lessonID: number): Promise<AttendanceRecord[]> {
    const res = await this.request(`/buoi-hoc/${lessonID}/diem-danh`)
    return Array.isArray(res) ? res : res.data || []
  },

  async manualCheckin(lessonID: number, svID: number) {
    return this.request(`/protected/buoi-hoc/${lessonID}/diem-danh/${svID}`, {
      method: 'POST',
    })
  },

  async manualCancel(lessonID: number, svID: number) {
    return this.request(`/protected/buoi-hoc/${lessonID}/diem-danh/${svID}`, {
      method: 'DELETE',
    })
  },

  async registerFace(svID: number, imageBlob: Blob, override = false) {
    const formData = new FormData()
    formData.append('image', imageBlob, 'register.jpg')
    if (override) {
      formData.append('override', 'true')
    }
    return this.request(`/protected/sinh-vien/${svID}/face`, {
      method: 'POST',
      body: formData,
    })
  },

  async checkin(lessonID: number, imageBlob: Blob) {
    const formData = new FormData()
    formData.append('image', imageBlob, 'checkin.jpg')
    return this.request(`/buoi-hoc/${lessonID}/checkin`, {
      method: 'POST',
      body: formData,
    })
  },
}
