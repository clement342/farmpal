interface SectionHeaderProps {
  label?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ label, title, description }: SectionHeaderProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
      {label && (
        <span className="text-xs font-medium tracking-widest uppercase text-text-muted mb-4">
          {label}
        </span>
      )}
      <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-text-primary">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-lg text-text-secondary leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
