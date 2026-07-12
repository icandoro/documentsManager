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

export function readPackageTemplates() {
  const saved = window.localStorage.getItem(packageTemplatesStorageKey);

  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as PackageTemplate[];

    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(packageTemplatesStorageKey);
  }

  return [];
}

export function writePackageTemplates(templates: PackageTemplate[]) {
  window.localStorage.setItem(packageTemplatesStorageKey, JSON.stringify(templates));
}
