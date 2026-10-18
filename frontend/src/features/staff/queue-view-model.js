export function selectWaitingTickets(snapshot) {
  return snapshot.filter((ticket) => ticket.status === "waiting");
}
