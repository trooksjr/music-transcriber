// This is our main serverless function.

exports.handler = async function(event, context) {
    // We dynamically import node-fetch inside the function.
    const fetch = (await import('node-fetch')).default;

    // --- PART 1: GET RAW TRANSCRIPTION FROM ASSEMBLYAI ---

    const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyaiApiKey) {
        return { statusCode: 500, body: 'AssemblyAI API key not found.' };
    }

    const assemblyaiEndpoint = 'https://api.assemblyai.com/v2/transcript';
    const audioData = JSON.parse(event.body).audio;
    let rawLyrics = "No lyrics found.";

    try {
        // Upload the file to AssemblyAI
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: { 'authorization': assemblyaiApiKey },
            body: Buffer.from(audioData, 'base64')
        });
        const uploadData = await uploadResponse.json();
        const audioUrl = uploadData.upload_url;

        if (!audioUrl) {
            throw new Error('Failed to upload audio file to AssemblyAI.');
        }

        // Submit the file for transcription
        const transcriptResponse = await fetch(assemblyaiEndpoint, {
            method: 'POST',
            headers: { 'authorization': assemblyaiApiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ audio_url: audioUrl })
        });
        let transcriptData = await transcriptResponse.json();

        // Poll for the result
        while (transcriptData.status !== 'completed' && transcriptData.status !== 'error') {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const pollResponse = await fetch(`${assemblyaiEndpoint}/${transcriptData.id}`, { headers: { 'authorization': assemblyaiApiKey } });
            transcriptData = await pollResponse.json();
        }

        if (transcriptData.status === 'error') {
            throw new Error(`AssemblyAI Error: ${transcriptData.error}`);
        }
        
        rawLyrics = transcriptData.text || "No lyrics found.";

    } catch (error) {
        console.error("Error during AssemblyAI transcription:", error);
        // We can still try to format if we have some text, otherwise return error
        if (rawLyrics === "No lyrics found.") {
             return { statusCode: 500, body: `An error occurred during transcription: ${error.message}` };
        }
    }


    // --- PART 2: FORMAT THE LYRICS WITH GEMINI ---
    
    let formattedLyrics = rawLyrics; // Default to raw lyrics if formatting fails

    try {
        const geminiApiKey = ""; // This is handled automatically by the system.
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${geminiApiKey}`;

        const prompt = `Please format the following song lyrics into a standard song structure. Use headings like [Verse], [Chorus], [Bridge], etc. Ensure the output is only the formatted lyrics and nothing else. Here are the lyrics:\n\n${rawLyrics}`;
        
        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };

        const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (geminiResponse.ok) {
            const geminiResult = await geminiResponse.json();
            if (geminiResult.candidates && geminiResult.candidates.length > 0) {
                formattedLyrics = geminiResult.candidates[0].content.parts[0].text;
            }
        }
        // If the Gemini call fails for any reason, we'll just fall back to the raw lyrics.
        
    } catch(error) {
        console.error("Error during Gemini formatting:", error);
        // Fallback to raw lyrics is already handled by the default value.
    }


    // --- PART 3: SEND THE FINAL, FORMATTED RESULT ---

    const finalResult = {
        lyrics: formattedLyrics,
        tabs: [
            "e|----------------------------------|",
            "B|---(Real tabs coming soon!)-----|",
            "G|----------------------------------|",
            "D|----------------------------------|",
            "A|----------------------------------|",
            "E|----------------------------------|"
        ]
    };

    return {
        statusCode: 200,
        body: JSON.stringify(finalResult)
    };
};