// in-memory "database" for now, resets every time the server restarts
export const applications = [
  { id: '1', company: 'Razorpay', role: 'Frontend Intern', status: 'Applied', appliedOn: '2026-10-20', priority: 'High' },
  { id: '2', company: 'Zerodha', role: 'Backend Intern', status: 'Interview', appliedOn: '2026-10-14', priority: 'Medium' },
  { id: '3', company: 'Google', role: 'STEP Intern', status: 'Interview', appliedOn: '2026-10-05', priority: 'High' },
  { id: '4', company: 'Swiggy', role: 'SDE Intern', status: 'Rejected', appliedOn: '2026-10-02', priority: 'Low' },
]

let nextId = 5

export function newId() {
  return String(nextId++)
}
