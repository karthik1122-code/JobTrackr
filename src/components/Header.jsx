function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function Header({ apps }) {
  // counts come straight from the apps array every render
  const interviews = apps.filter((a) => a.status === 'Interview').length
  const offers = apps.filter((a) => a.status === 'Offer').length

  return (
    <header className="header">
      <div className="brand">
        <span className="logo">JT</span>
        <h1>JobTrackr</h1>
      </div>
      <p className="stats">
        {plural(apps.length, 'application')} · {plural(interviews, 'interview')} · {plural(offers, 'offer')}
      </p>
    </header>
  )
}

export default Header
