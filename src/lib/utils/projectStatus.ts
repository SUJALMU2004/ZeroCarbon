export type ProjectStatusValue =
  | "not_submitted"
  | "pending"
  | "verified"
  | "rejected"
  | "resubmit_required"
  | string;

export interface ProjectStatusMeta {
  label: string;
  className: string;
}

export function getProjectStatusMeta(status: ProjectStatusValue): ProjectStatusMeta {
  if (status === "pending") {
    return {
      label: "Under Review",
      className: "bg-amber-100 text-amber-800",
    };
  }

  if (status === "verified") {
    return {
      label: "Verified",
      className: "bg-green-100 text-green-800",
    };
  }

  if (status === "rejected") {
    return {
      label: "Rejected",
      className: "bg-red-100 text-red-800",
    };
  }

  return {
    label: "Pending",
    className: "bg-gray-100 text-gray-600",
  };
}

