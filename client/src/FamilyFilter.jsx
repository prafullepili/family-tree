export default function FamilyFilter({ value, options, onChange, label }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      <option value="__all__">All groups</option>
      {options.map((group) => (
        <option key={group.key} value={group.key}>
          {group.name} ({group.count})
        </option>
      ))}
    </select>
  );
}
