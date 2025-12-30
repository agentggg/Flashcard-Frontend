export function autoGenerateRules(referenceCode, { language = "any" } = {}) {
  const code = String(referenceCode || "");

  const rules = [];
  const addReq = (desc, pattern, hint, weight = 1) =>
    rules.push({ description: desc, pattern, required: true, hint, weight });

  const addForbid = (desc, pattern, hint, weight = 1) =>
    rules.push({ description: desc, pattern, forbidden: true, hint, weight });

  // Generic patterns
  if (/\bimport\b/.test(code)) addReq("Has import usage", /\bimport\b/i, "Include required imports.", 0.8);

  // ROS2-ish heuristics
  if (/\brclpy\b/.test(code)) addReq("Uses rclpy", /\brclpy\b/i, "ROS 2 Python nodes typically use rclpy.", 1.2);

  if (/\bcreate_publisher\b/.test(code)) {
    addReq("Creates a publisher", /\bcreate_publisher\s*\(/i, "Create a publisher using create_publisher(...).", 1.3);
  }

  if (/\bpublish\s*\(/.test(code)) {
    addReq("Publishes a message", /\.publish\s*\(/i, "Call publish(...) on the publisher.", 1.2);
  }

  // Common anti-patterns
  addForbid(
    "Avoid publishing raw string literals (common ROS 2 type mismatch)",
    /\.publish\s*\(\s*['"`]/i,
    "Publish a message object, not a raw string literal.",
    1.4
  );

  // Message type hints
  if (/\bTwist\b/.test(code)) {
    rules.push({
      groupId: "msg_type",
      groupTitle: "Uses a valid ROS 2 message type",
      required: true,
      groupWeight: 1.4,
      description: "Uses geometry_msgs/Twist",
      pattern: /\bTwist\b/i,
      hint: "Make sure you use a proper ROS 2 message type (e.g., Twist or String).",
    });
  }
  if (/\bString\b/.test(code) || /std_msgs/.test(code)) {
    rules.push({
      groupId: "msg_type",
      groupTitle: "Uses a valid ROS 2 message type",
      required: true,
      groupWeight: 1.4,
      description: "Uses std_msgs/String",
      pattern: /\bstd_msgs\b|\bString\b/i,
      hint: "Make sure you use a proper ROS 2 message type (e.g., Twist or String).",
    });
  }

  // De-dup by description + flags
  const key = (r) => `${r.groupId || ""}|${r.description}|${r.required ? "R" : ""}${r.forbidden ? "F" : ""}${r.optional ? "O" : ""}`;
  const seen = new Set();
  return rules.filter((r) => {
    const k = key(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}