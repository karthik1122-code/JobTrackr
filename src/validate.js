export function today() {
  // local date as yyyy-mm-dd, same format the date input gives us
  const d = new Date()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

// quick checks before sending. The API checks everything again (and catches duplicates with a 409)
export function validate(form) {
  const errors = {}
  const company = form.company.trim()
  const role = form.role.trim()

  if (!company) errors.company = 'Company is required'
  else if (company.length < 2 || company.length > 60) errors.company = 'Company must be 2–60 characters'

  if (!role) errors.role = 'Role is required'
  else if (role.length < 2 || role.length > 60) errors.role = 'Role must be 2–60 characters'

  if (!form.appliedOn) errors.appliedOn = 'Pick the date you applied'
  else if (form.appliedOn > today()) errors.appliedOn = "Date can't be in the future"

  // salary is only checked by the API, so a negative number shows the server's 400 under the field

  return errors
}
