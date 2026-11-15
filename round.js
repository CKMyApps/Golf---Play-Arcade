"use strict";
const Golf = (() => {
  const holes = [
    [361,4,4,2], [389,4,3,3], [206,3,4,2], [500,5,7,2],
    [408,4,2,4], [359,4,6,4], [424,4,4,2], [388,4,4,4],
    [196,3,7,2], [400,4,7,2], [560,5,7,2], [132,3,2,2],
    [357,4,4,4], [294,4,2,4], [475,5,2,3], [375,4,4,2],
    [180,3,6,2], [550,5,6,6]
  ].map(([yards, par, right, left]) => ({yards, par, right, left}));
  const clubs = {Driver:250, "3 Wood":210, "5 Iron":165, "9 Iron":120,
    "Pitching Wedge":85, "Sand Wedge":60, Putter:18};
  const lies = ["", "Fairway", "Rough", "Trees", "Adjacent fairway", "Bunker", "Water", "Out of bounds"];
  const opening = "Choose a club and swing.";
  const weaknesses = ["hook", "slice", "distance", "bunker", "putting"];
  const fresh = (handicap, weakness) => ({
    handicap, weakness, scores: [], strokes: 0, forward: 0, lateral: 0,
    lie: 1, pending: false, message: opening
  });
  const finished = round => round.scores.length === holes.length;
  const hole = round => holes[Math.min(round.scores.length, holes.length - 1)];
  const distance = round => Math.hypot(hole(round).yards - round.forward, round.lateral);
  const onGreen = round => round.strokes > 0 && distance(round) <= 17;
  const heading = round => Math.atan2(-round.lateral, hole(round).yards - round.forward);
  const center = (forward, yards, index) => Math.sin(forward / yards * Math.PI * 2) * (index % 5 - 2) * 7;
  const recommended = round => {
    if (onGreen(round)) return "Putter";
    if (round.lie === 5) return "Sand Wedge";
    return Object.keys(clubs).slice(0, -1).reverse().find(key => clubs[key] >= distance(round)) ?? "Driver";
  };

  function valid(round) {
    return round && Number.isInteger(round.handicap) && round.handicap >= 0 && round.handicap <= 30
      && weaknesses.includes(round.weakness) && Array.isArray(round.scores)
      && round.scores.length <= holes.length
      && round.scores.every(score => Number.isInteger(score) && score >= 1 && score <= 15)
      && Number.isInteger(round.strokes) && round.strokes >= 0 && round.strokes < 15
      && Number.isFinite(round.forward) && Number.isFinite(round.lateral)
      && [1, 2, 3, 4, 5].includes(round.lie) && typeof round.pending === "boolean"
      && typeof round.message === "string";
  }

  function swing(round, club, power, aim, random = Math.random) {
    if (finished(round) || round.pending) return false;
    const green = onGreen(round);
    const yards = hole(round).yards;
    const forgiveness = round.handicap / 30;
    const variation = 2 * random() - 1;
    const direct = heading(round);
    let drift = variation * (1 - forgiveness * .7) * (green ? .025 : .09);
    if (!green && round.weakness === "hook") drift -= .035;
    if (!green && round.weakness === "slice") drift += .035;
    if (green && round.weakness === "putting") drift += variation * .07;
    let carry = clubs[green ? "Putter" : club] * power / 100;
    if (!green) {
      carry *= 1 + variation * .07;
      if (round.weakness === "distance") carry *= .9;
      if ([2, 3].includes(round.lie)) carry *= .72;
      if (round.lie === 5) carry *= (club === "Sand Wedge" ? .83 : .35)
        * (round.weakness === "bunker" ? .78 : 1);
    }
    const angle = direct + aim * Math.PI / 180 + drift;
    const forward = round.forward + Math.cos(angle) * carry;
    const lateral = round.lateral + Math.sin(angle) * carry;
    const remaining = Math.hypot(yards - forward, lateral);
    const projected = Math.max(0, Math.min(carry, distance(round) * Math.cos(angle - direct)));
    const closest = Math.hypot(yards - round.forward - Math.cos(angle) * projected,
      round.lateral + Math.sin(angle) * projected);
    round.strokes++;

    function endHole(result) {
      round.message = result + " · " + round.strokes + (round.strokes === 1 ? " stroke" : " strokes");
      round.scores.push(round.strokes);
      Object.assign(round, {strokes: 0, forward: 0, lateral: 0, lie: 1, pending: !finished(round)});
      return true;
    }

    if (closest <= (green ? .4 : .7) + forgiveness * .5
        && (green || Math.abs(carry - distance(round)) < 1.4)) {
      return endHole(round.strokes === 1 ? "Hole in one!" : "Holed it!");
    }
    if (round.strokes === 15) return endHole("Stroke limit reached");
    const offset = lateral - center(forward, yards, round.scores.length);
    let lie = 1;
    if (remaining > 17) {
      if (Math.abs(lateral) > 92 || forward > yards + 68 || forward < -42) lie = 7;
      else if (forward > yards - 50 && lateral >= 18 && lateral <= 34) lie = 5;
      else if (Math.abs(offset) > 34) lie = offset > 0 ? hole(round).right : hole(round).left;
      else if (Math.abs(offset) > 20) lie = 2;
    }
    if (lie === 6 || lie === 7) {
      round.strokes++;
      if (round.strokes === 15) return endHole("Stroke limit reached");
      round.message = lies[lie] + " · One penalty stroke";
    } else {
      Object.assign(round, {forward, lateral, lie});
      round.message = remaining <= 17 ? "On the green · " + Math.round(remaining * 3) + " ft"
        : lies[lie] + " · " + Math.round(remaining) + " yds left";
    }
    return false;
  }

  function totals(round) {
    return {
      strokes: round.scores.reduce((sum, score) => sum + score, 0),
      par: round.scores.reduce((sum, _, index) => sum + holes[index].par, 0)
    };
  }

  return {holes, clubs, lies, opening, fresh, finished, hole, distance, onGreen,
    heading, center, recommended, valid, swing, totals};
})();
if (typeof module !== "undefined") module.exports = Golf;
