const sections = [
  {
    title: 'Overdue',
    items: ['Review packet Alpha', 'Signature follow-up Bravo'],
  },
  {
    title: 'Blocked',
    items: ['Waiting on provider response', 'Pending pharmacy clarification'],
  },
  {
    title: 'Due Soon',
    items: ['Care plan review Charlie', 'Quarterly check-in Delta'],
  },
  {
    title: 'Recent Activity',
    items: ['Owner updated for review Echo', 'Follow-up note added to item Foxtrot'],
  },
];

function App() {
  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="eyebrow">Local prototype</p>
        <h1>Operations Command Center</h1>
      </header>

      <section className="dashboard-grid" aria-label="Operations dashboard">
        {sections.map((section) => (
          <article className="panel" key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;
