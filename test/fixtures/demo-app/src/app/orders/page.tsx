export default function OrdersList({ orders }: { orders: Order[] }) {
  return (
    <table>
      {orders.map((order) => (
        <tr key={order.id}><td>{order.number}</td></tr>
      ))}
    </table>
  )
}
