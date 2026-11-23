(() => {
  'use strict';

  const KEY = 'sms.students.v1';
  const FIELDS = ['name', 'matric', 'email', 'phone', 'department', 'level'];
  const $ = id => document.getElementById(id);

  const form = $('student-form');
  const formTitle = $('form-title');
  const submitBtn = $('submit-btn');
  const cancelBtn = $('cancel-btn');
  const listEl = $('student-list');
  const tableWrap = $('table-wrap');
  const emptyMsg = $('empty');
  const search = $('search');
  const dialog = $('confirm-dialog');
  const toastEl = $('toast');

  let students = load();
  let editingId = null;
  let pendingDeleteId = null;
  let toastTimer;

  /* ---------- Storage ---------- */
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(students));
    } catch {
      toast('Couldn’t save. Browser storage is blocked.', 'error');
    }
  }

  /* ---------- Helpers ---------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const taken = (key, value) =>
    students.some(s => s.id !== editingId && s[key].toLowerCase() === value.toLowerCase());

  function toast(message, type = 'ok') {
    toastEl.textContent = message;
    toastEl.className = 'toast show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 2800);
  }

  /* ---------- Validation ---------- */
  const RULES = {
    name: v => v.length < 3 ? 'Enter the full name (at least 3 characters).' : '',
    matric: v => !v ? 'Enter the matric number.'
      : taken('matric', v) ? 'This matric number is already registered.' : '',
    level: v => !v ? 'Select a level.' : '',
    email: v => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter a valid email address.'
      : taken('email', v) ? 'This email address is already registered.' : '',
    phone: v => !/^\+?\d{7,15}$/.test(v.replace(/[\s-]/g, '')) ? 'Enter a valid phone number (7 to 15 digits).' : '',
    department: v => v.length < 2 ? 'Enter the department.' : ''
  };

  function setError(field, message) {
    $(field + '-error').textContent = message;
    $(field).setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearErrors() {
    FIELDS.forEach(f => setError(f, ''));
  }

  function validate() {
    const data = {};
    let firstInvalid = null;
    FIELDS.forEach(f => {
      const value = $(f).value.trim();
      const message = RULES[f](value);
      setError(f, message);
      if (message && !firstInvalid) firstInvalid = $(f);
      data[f] = value;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return null;
    }
    return data;
  }

  /* ---------- Form ---------- */
  function resetForm() {
    form.reset();
    clearErrors();
    editingId = null;
    formTitle.textContent = 'Register a student';
    submitBtn.textContent = 'Register student';
    cancelBtn.hidden = true;
  }

  function startEdit(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;
    clearErrors();
    editingId = id;
    FIELDS.forEach(f => { $(f).value = student[f]; });
    formTitle.textContent = 'Edit student';
    submitBtn.textContent = 'Save changes';
    cancelBtn.hidden = false;
    render();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('name').focus({ preventScroll: true });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const data = validate();
    if (!data) return;

    if (editingId) {
      students = students.map(s => s.id === editingId ? { ...s, ...data } : s);
      toast('Changes saved');
    } else {
      students.unshift({ id: uid(), ...data });
      toast('Student registered');
    }
    save();
    resetForm();
    render();
  });

  form.addEventListener('input', e => {
    if (FIELDS.includes(e.target.id)) setError(e.target.id, '');
  });

  cancelBtn.addEventListener('click', () => {
    resetForm();
    render();
  });

  /* ---------- Search ---------- */
  search.addEventListener('input', render);

  /* ---------- Edit and delete ---------- */
  listEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') {
      startEdit(id);
    } else {
      const student = students.find(s => s.id === id);
      if (!student) return;
      pendingDeleteId = id;
      $('confirm-text').textContent =
        `${student.name} (${student.matric}) will be removed from the registry. This can’t be undone.`;
      dialog.showModal();
    }
  });

  $('confirm-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { pendingDeleteId = null; });

  $('confirm-delete').addEventListener('click', () => {
    if (!pendingDeleteId) return;
    if (pendingDeleteId === editingId) resetForm();
    students = students.filter(s => s.id !== pendingDeleteId);
    save();
    dialog.close();
    render();
    toast('Student deleted');
  });

  /* ---------- Keep other open tabs in sync ---------- */
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return;
    students = load();
    if (editingId && !students.some(s => s.id === editingId)) resetForm();
    render();
  });

  /* ---------- Render ---------- */
  function render() {
    const q = search.value.trim().toLowerCase();
    const shown = q
      ? students.filter(s => FIELDS.map(f => s[f]).join(' ').toLowerCase().includes(q))
      : students;

    $('count').textContent = students.length;
    $('count-label').textContent = students.length === 1 ? 'student registered' : 'students registered';
    $('result-info').textContent = q ? `Showing ${shown.length} of ${students.length}` : '';

    listEl.innerHTML = shown.map(s => `
      <tr class="${s.id === editingId ? 'editing' : ''}">
        <td class="name" data-label="Name">${esc(s.name)}</td>
        <td data-label="Matric no.">${esc(s.matric)}</td>
        <td data-label="Email">${esc(s.email)}</td>
        <td data-label="Phone">${esc(s.phone)}</td>
        <td data-label="Department">${esc(s.department)}</td>
        <td data-label="Level">${esc(s.level)}</td>
        <td class="actions">
          <button type="button" class="btn ghost small" data-action="edit" data-id="${s.id}">Edit</button>
          <button type="button" class="btn danger small" data-action="delete" data-id="${s.id}">Delete</button>
        </td>
      </tr>`).join('');

    tableWrap.hidden = shown.length === 0;
    emptyMsg.hidden = shown.length > 0;
    emptyMsg.textContent = students.length === 0
      ? 'No students registered yet. Use the form to add the first one.'
      : `No student matches “${search.value.trim()}”.`;
  }

  render();
})();