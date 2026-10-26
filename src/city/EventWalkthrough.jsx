import React from "react";
const steps = [
  [
    "Select an Event",
    "Choose October 19 or October 24–25 from the storm selector.",
    "summary",
  ],
  [
    "Before the Rain",
    "Read the rain expected by the earlier weather run. Historical priorities were reconstructed later.",
    "before",
  ],
  [
    "During the Rain",
    "Play the hourly estimates and keep station totals separate.",
    "during",
  ],
  [
    "After the Rain",
    "Review reported places, reviewed checks and missing evidence.",
    "after",
  ],
  [
    "Explore an Area",
    "Search Urdesa or another recognizable name. All local figures follow that selection.",
    "summary",
  ],
  [
    "Scenario Explorer",
    "Change a hypothetical rainfall assumption. Simulated findings never become real impacts.",
    "scenario",
  ],
  [
    "Key Findings",
    "Compare what is documented with what still needs a check. Export the impact report.",
    "after",
  ],
];
export default function EventWalkthrough({ onPhase, onScenario, onClose }) {
  return (
    <div className="demo-steps">
      {steps.map(([title, text, phase], i) => (
        <article key={title}>
          <span>{i + 1}</span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
            <button
              onClick={() => {
                phase === "scenario" ? onScenario?.() : onPhase(phase);
                onClose();
              }}
            >
              Explore this step
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
