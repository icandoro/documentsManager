export type PackageTemplateDocument = {
  id: number;
  title: string;
  category: string;
};

export type PackageTemplate = {
  id: string;
  name: string;
  documents: PackageTemplateDocument[];
  createdAt: string;
};

export const packageTemplatesStorageKey = "docmanager_package_templates";

export const defaultPackageTemplates: PackageTemplate[] = [
  {
    id: "template-dosar-angajare",
    name: "test",
    createdAt: "12 iul. 2026",
    documents: [
      { id: 1, title: "Buletin", category: "Identitate" },
      { id: 2, title: "Contract de munca", category: "HR" },
    ],
  },
];

export function packageTemplatesStorageKeyForContext(contextId = "independent") {
  return `${packageTemplatesStorageKey}_${contextId}`;
}

export function readPackageTemplates(contextId = "independent") {
  const scopedKey = packageTemplatesStorageKeyForContext(contextId);
  const saved = window.localStorage.getItem(scopedKey) ?? (contextId === "independent" ? window.localStorage.getItem(packageTemplatesStorageKey) : null);

  if (!saved) return contextId === "independent" ? defaultPackageTemplates : [];

  try {
    const parsed = JSON.parse(saved) as PackageTemplate[];

    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(scopedKey);
  }

  return [];
}

export function writePackageTemplates(templates: PackageTemplate[], contextId = "independent") {
  window.localStorage.setItem(packageTemplatesStorageKeyForContext(contextId), JSON.stringify(templates));
}
