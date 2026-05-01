// Returns true if the supplied password matches any entry in TOOLS_PASSWORD
// TOOLS_PASSWORD can be a single password or a comma-separated list:
//   e.g.  TOOLS_PASSWORD=adminpass,poster1pass,poster2pass
export function isValidPassword(password: string): boolean {
  const stored = process.env.TOOLS_PASSWORD ?? ''
  const valid = stored.split(',').map((p) => p.trim()).filter(Boolean)
  return valid.includes(password)
}
