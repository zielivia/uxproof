export function Button({ children }: { children: React.ReactNode }) {
  return <button className="bg-primary">{children}</button>
}
export const IconButton = ({ icon }: { icon: React.ReactNode }) => <button>{icon}</button>
