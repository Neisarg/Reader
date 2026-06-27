export type ReadingStatus = "glance" | "read" | "study" | "experiment" | "done";

export interface Paper {
  key: string;
  version: number;
  title: string;
  authors: string;
  abstract: string;
  date: string;
  url: string;
  doi: string;
  publicationTitle: string;
  collections: string[];
  tags: Array<{ tag: string; type?: number }>;
  dateAdded: string;
  dateModified: string;
  status: ReadingStatus;
  itemType: string;
}

export interface ZoteroCollection {
  key: string;
  name: string;
  parentCollection: string | false;
}

export const STATUS_CONFIG: Record<
  ReadingStatus,
  { label: string; icon: string; color: string; description: string }
> = {
  glance: {
    label: "Glance",
    icon: "eye",
    color: "amber",
    description: "Quick scan — skim title, abstract, figures",
  },
  read: {
    label: "Read",
    icon: "book-open",
    color: "blue",
    description: "Full read-through of the paper",
  },
  study: {
    label: "Study",
    icon: "graduation-cap",
    color: "violet",
    description: "Deep study — understand proofs, methods, details",
  },
  experiment: {
    label: "Experiment",
    icon: "flask-conical",
    color: "emerald",
    description: "Reproduce results or build on the work",
  },
  done: {
    label: "Done",
    icon: "check-circle",
    color: "zinc",
    description: "Finished — no further action needed",
  },
};
