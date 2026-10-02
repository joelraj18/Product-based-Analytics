// Erlang C queueing model for real-time (voice/chat) staffing.
// volume: contacts arriving in the interval; aht: seconds; interval: seconds.

export const trafficIntensity = (volume, aht, interval = 1800) => (volume * aht) / interval;

// Probability a contact waits, via the numerically stable Erlang B recursion.
export const erlangC = (agents, intensity) => {
  if (intensity <= 0) return 0;
  if (agents <= intensity) return 1;
  let b = 1;
  for (let n = 1; n <= agents; n++) b = (intensity * b) / (n + intensity * b);
  return (agents * b) / (agents - intensity * (1 - b));
};

export const serviceLevel = (agents, volume, aht, targetSeconds, interval = 1800) => {
  const a = trafficIntensity(volume, aht, interval);
  if (volume <= 0) return 1;
  if (agents <= a) return 0;
  return 1 - erlangC(agents, a) * Math.exp((-(agents - a) * targetSeconds) / aht);
};

export const averageSpeedOfAnswer = (agents, volume, aht, interval = 1800) => {
  const a = trafficIntensity(volume, aht, interval);
  if (agents <= a) return Infinity;
  return (erlangC(agents, a) * aht) / (agents - a);
};

// Smallest agent count meeting the SL target without exceeding max occupancy.
export const requiredAgents = ({ volume, aht, interval = 1800, slTarget = 0.8, slSeconds = 20, maxOccupancy = 0.9 }) => {
  if (!volume || volume <= 0 || !aht) return { agents: 0, serviceLevel: 1, occupancy: 0, asa: 0, intensity: 0 };
  const a = trafficIntensity(volume, aht, interval);
  let n = Math.max(1, Math.floor(a) + 1);
  while (n < a * 10 + 100) {
    const sl = serviceLevel(n, volume, aht, slSeconds, interval);
    if (sl >= slTarget && a / n <= maxOccupancy) {
      return { agents: n, serviceLevel: sl, occupancy: a / n, asa: averageSpeedOfAnswer(n, volume, aht, interval), intensity: a };
    }
    n++;
  }
  return { agents: n, serviceLevel: serviceLevel(n, volume, aht, slSeconds, interval), occupancy: a / n, asa: averageSpeedOfAnswer(n, volume, aht, interval), intensity: a };
};
