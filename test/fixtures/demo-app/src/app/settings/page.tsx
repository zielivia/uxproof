import { useForm } from 'react-hook-form'

export default function Settings() {
  const { handleSubmit } = useForm()
  return <form onSubmit={handleSubmit(save)}>settings</form>
}
