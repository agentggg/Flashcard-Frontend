// CoursePickerModal.jsx
export default function CoursePickerModal({
  open,
  title,
  subtitle,
  courses = [],
  onSelect,
  onClose,
}) {
  if (!open) return null;

  const handlePick = (c) => {
    onSelect?.(c); // pass full object (FlashcardLab extracts id safely)
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle ? <div className="modal-subtitle">{subtitle}</div> : null}
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {courses.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No courses found.</div>
          ) : (
            <div className="course-list">
              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="course-row" // keep/add your existing row class too if you have one
                  onClick={() => handlePick(c)}
                >
                  <div className="course-row__left">
                    <div className="course-row__title">{c.label}</div>
                    {c.meta ? <div className="course-row__meta">{c.meta}</div> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}