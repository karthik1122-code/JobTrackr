export const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']

export const PRIORITIES = ['Low', 'Medium', 'High']

// what each status moves to when you click "next"
export const NEXT_STATUS = {
  Applied: 'Interview',
  Interview: 'Offer',
}
