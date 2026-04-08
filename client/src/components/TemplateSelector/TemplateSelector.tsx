import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { LayoutTemplate } from "../../types/project";
import { useProjectStore } from "../../stores/projectStore";

interface TemplateSelectorProps {
  onSelect: () => void;
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const createProject = useProjectStore((s) => s.createProject);

  useEffect(() => {
    api.templates.list().then((t) => {
      setTemplates(t);
      setLoading(false);
    });
  }, []);

  const handleSelect = async (templateId: string) => {
    await createProject("My Keyboard", templateId);
    onSelect();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        Loading templates...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-white mb-2">
        Choose a Layout
      </h2>
      <p className="text-sm text-neutral-400 mb-8">
        Pick a starting template. You can customize every key position after.
      </p>

      <div className="grid grid-cols-1 gap-4">
        {templates.map((t) => (
          <button
            key={t.template_id}
            onClick={() => handleSelect(t.template_id)}
            className="text-left p-5 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:border-indigo-500/50 hover:bg-neutral-900 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                  {t.name}
                </h3>
                <p className="text-sm text-neutral-500 mt-1">
                  {t.description}
                </p>
              </div>
              <span className="text-xs text-neutral-600 font-mono">
                {t.key_count} keys
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
