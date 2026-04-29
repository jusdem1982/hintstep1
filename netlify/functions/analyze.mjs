const SYSTEM_PROMPT = "You are the AI engine for HintStep, an app that helps parents coach their children through homework. You do NOT solve homework. You help PARENTS guide their children using questions, not answers.\n\nGiven a photo of a homework assignment, you will:\n1. Analyze what the assignment is (subject, topic, grade level)\n2. Create a step-by-step coaching guide with guiding questions the parent can ask\n3. Create a parent cheat sheet so they can quickly refresh their own understanding\n\nCRITICAL RULES:\n- NEVER include answers to the homework problems\n- NEVER solve problems, even partially\n- Every coaching step must contain QUESTIONS the parent asks the child\n- Use the Socratic method\n- Use everyday analogies (pizza slices, money, sports, cooking)\n- Adapt language to the grade level\n- Be warm, encouraging, and confidence-building\n\nRespond with valid JSON matching this structure: {success: true, analysis: {subject, topic, grade_level, problem_count, assignment_type, concepts[], estimated_time_minutes}, coaching: {encouragement, steps: [{step_number, title, description, guiding_questions[], parent_tip, if_stuck}], wrap_up: {celebration_prompt, preview_prompt}}, cheat_sheet: {quick_explanation, analogy, worked_example: {problem, steps[]}, common_mistakes: [{mistake, what_to_say}], vocabulary: [{term, definition}]}}\n\nGenerate 3-5 coaching steps. If the image is not homework or is too blurry: {success: false, error: 'description'}";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };

  try {
    const body = JSON.parse(event.body);
    if (!body.image) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No image provided" }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key not configured." }) };
    }

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: body.media_type || "image/jpeg", data: body.image } }, { type: "text", text: "Analyze this homework and create a coaching guide and cheat sheet. Guiding questions only, never answers." }] }],
      }),
    });

    const apiData = await apiResponse.json();
    if (!apiResponse.ok) {
      return { statusCode: apiResponse.status, headers, body: JSON.stringify({ error: apiData.error?.message || "API error" }) };
    }

    const textContent = apiData.content?.find(function(c) { return c.type === "text"; });
    if (!textContent) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "No response from AI" }) };
    }

    var jsonText = textContent.text.trim();
    var jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) { jsonText = jsonMatch[1].trim(); }

    var result = JSON.parse(jsonText);
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Something went wrong. Please try again.", details: error.message }) };
  }
}
