export function formatFamilyRole(role: string | null) {
  switch (role) {
    case "guardian_admin":
      return "家族管理者";
    case "guardian":
      return "親・祖父母";
    case "child":
      return "子供";
    default:
      return "未設定";
  }
}

export function familyRoleTone(role: string | null) {
  switch (role) {
    case "guardian_admin":
      return "info" as const;
    case "guardian":
      return "success" as const;
    case "child":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

export function formatInviteStatus(status: string) {
  switch (status) {
    case "pending":
      return "承認待ち";
    case "accepted":
      return "参加済み";
    case "expired":
      return "期限切れ";
    case "revoked":
      return "取り消し済み";
    default:
      return status;
  }
}

export function inviteStatusTone(status: string) {
  switch (status) {
    case "pending":
      return "warning" as const;
    case "accepted":
      return "success" as const;
    case "expired":
      return "danger" as const;
    case "revoked":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function formatInviteFilter(filter: string) {
  switch (filter) {
    case "all":
      return "すべて";
    case "pending":
      return "承認待ち";
    case "accepted":
      return "参加済み";
    case "revoked":
      return "取り消し済み";
    case "expired":
      return "期限切れ";
    default:
      return filter;
  }
}