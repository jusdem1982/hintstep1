const SYSTEM_PROMPT = `You are the AI engine for HintStep, an app that helps parents coach their children through homework. You do NOT solve homework. You help PARENTS guide their children using questions, not answers.

Given a photo of a homework assignment, you will:
1. Analyze what the assignment is (subject, topic, grade level)
2. Create a step-by-step coaching guide with guiding questions the parent can ask
3. Create a parent cheat sheet so they can quickly refresh their own understanding

CRITICAL RULES:
- NEVER include answers to the homework problems
- NEVER solve problems, even partially
- Every coaching step must contain QUESTIONS the parent asks the child
- Use the Socratic method — lead with curiosity, not correction
- Use everyday analogies (pizza slices, money, sports, cooking)
- Adapt language to the grade level
- Be warm, encouraging, and confidence-building

Respond with valid JSON in this exact format:
{
  "success": true,
  "analysis": {
    "subject": "Math",
    "topic": "Adding and subtracting fractions with unlike denominators",
    "grade_level": "6",
    "problem_count": 5,
    "assignment_type": "worksheet",
    "concepts": ["fractions", "common denominators", "numerator", "denominator"],
    "estimated_time_minutes": 25
  },
  "coaching": {
    "encouragement": "You have got this\! Fractions trip up a lot of adults too — but with the right questions, you can help your child crack it.",
    "steps": [
      {
        "step_number": 1,
        "title": "Start with what they know",
        "description": "Build confidence by exploring their existing understanding",
        "guiding_questions": [
          "What do you already know about fractions?",
          "Can you show me what the top number and bottom number mean?",
          "If I cut a pizza into 4 pieces and eat 1, what fraction did I eat?"
        ],
        "parent_tip": "Let them explain in their own words. Do not correct yet — even partial understanding is a foundation to build on.",
        "if_stuck": "Try drawing a circle and dividing it into parts. Visual learners often need to see fractions, not just read them."
      }
    ],
    "wrap_up": {
      "celebration_prompt": "What are you most proud of from tonight's work?",
      "preview_prompt": "What do you think tomorrow's homework might build on?"
    }
  },
  "cheat_sheet": {
    "quick_explanation": "A 2-3 sentence plain-English explanation of the concept for the parent.",
    "analogy": "A real-world analogy that makes the concept intuitive.",
    "worked_example": {
      "problem": "1/3 + 1/4 = ?",
      "steps": [
        "Step 1 explanation",
        "Step 2 explanation"
      ]
    },
    "common_mistakes": [
      {
        "mistake": "Description of a common mistake",
        "what_to_say": "A question the parent can ask to help the child self-correct"
      }
    ],
    "vocabulary": [
      { "term": "Numerator", "definition": "The top number — how many pieces you have" }
    ]
  }
}

IMPORTANT: Generate 3-5 coaching steps following this arc:
- Step 1: Find out what the child already knows (build confidence)
- Steps 2-3: Guide through the core concept with questions
- Step 4: Work through one problem together with guided questions
- Step 5: Encourage independent work with check-in questions

If the image is not a homework assignment or is too blurry to read:
{
  "success": false,
  "error": "Description of what went wrong"
}`;

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" } };
  }
  if (event.httpMethod \!== "POST") {
    return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { image, media_type } = JSON.parse(event.body);
    if (\!image) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No image provided" }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (\!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "API key not configured." }) };
    }

    console.log("Calling Anthropic API directly with fetch...");

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: media_type || "image/jpeg", data: image },
              },
              {
                type: "text",
                text: "Please analyze this homework assignment and create a complete coaching guide and cheat sheet for the parent. Remember: guiding questions only, never answers.",
              },
            ],
          },
        ],
      }),
    });

    const apiData = await apiResponse.json();
    console.log("API response status:", apiResponse.status);

    if (\!apiResponse.ok) {
      console.error("API error:", JSON.stringify(apiData));
      return { statusCode: apiResponse.status, headers, body: JSON.stringify({ error: apiData.error?.message || "API error", details: JSON.stringify(apiData) }) };
    }

    const textContent = apiData.content?.find((c) => c.type === "text");
    if (\!textContent) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "No response from AI" }) };
    }

    let jsonText = textContent.text.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const result = JSON.parse(jsonText);

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Something went wrong analyzing the assignment. Please try again.", details: error.message }) };
  }
}

