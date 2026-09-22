export type FieldType =
  | "text" | "textarea" | "number" | "bool" | "time" | "select" | "multi" | "rating" | "closet" | "date";

export type ClosetKind = "shirt" | "pants" | "shoes" | "socks" | "hat" | "jacket";

export interface Field {
  /** Column header in the sheet. */
  key: string;
  /** Shorter label for the form; defaults to key. */
  label?: string;
  type: FieldType;
  /** "prev" = copy most recent logged day, "mode" = most common recent value, string = literal. */
  default?: "prev" | "mode" | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
  closet?: ClosetKind;
  /** Only render when another field has this value. */
  showIf?: { key: string; equals: string };
}

export interface FieldGroup {
  group: string;
  fields: Field[];
}

export type SectionItem = Field | FieldGroup;

export interface Section {
  id: string;
  title: string;
  icon: string;
  items: SectionItem[];
}

export function isGroup(item: SectionItem): item is FieldGroup {
  return (item as FieldGroup).group !== undefined;
}

export function sectionFields(section: Section): Field[] {
  return section.items.flatMap((i) => (isGroup(i) ? i.fields : [i]));
}
