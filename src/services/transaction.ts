export function parseTransaction(data: string) {
    const regex = /Rs\.(\d+\.\d+)\s+credited\s+to\s+a\/c\s+\*\d+\s+on\s+(\d{2}\/\d{2}\/\d{4})\s+by\s+a\/c\s+linked\s+to\s+VPA\s+([\w\-@.]+)\s+\(UPI\s+Ref\s+no\s+(\d+)\)/;
    const match = data.match(regex);

    if (match) {
        return {
            amount: parseFloat(match[1]),
            date: match[2],
            vpa: match[3],
            upiRef: match[4]
        };
    }

    return null;
}

export function parseTransactionHDFC(data: string) {
const regex = /Rs\.(\d+\.\d+) credited to HDFC Bank A\/c XX\d+ on (\d{2}-\d{2}-\d{2}) from VPA ([\w\-@.]+) \(UPI (\d+)\)/;
const match = data.match(regex);

  if (match) {
    return {
      amount: parseFloat(match[1]),
      date: match[2],
      vpa: match[3],
      upiRef: match[4],
    };
  }

  return null;
}
