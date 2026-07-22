import { Button } from '../components/Button'

export default function Home() {
  return (
    <div style={{ color: '#ff0000' }}>
      <button onClick={save}>Raw save</button>
      <input placeholder="raw input" />
      <Button>Proper</Button>
      <span className="bg-[rgba(255,0,0,0.5)]">tinted</span>
    </div>
  )
}
