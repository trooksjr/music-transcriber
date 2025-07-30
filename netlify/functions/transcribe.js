// This is our main serverless function.
// NOTE: We are no longer using require('node-fetch') at the top.

exports.handler = async function(event, context) {
    // We dynamically import node-fetch inside the function.
    // This is a more modern and robust way that works better with Netlify's build system.
    const fetch = (await import('node-fetch')).default;

    // 1. SECURELY GET THE API KEY
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: 'AssemblyAI API key not found.' };
    }

    // 2. PREPARE TO CALL ASSEMBLYAI
    const assemblyaiEndpoint = 'https://api.assemblyai.com/v2/transcript';
    const headers = {
        'authorization': apiKey,
        'content-type': 'application/json'
    };

    const audioData = JSON.parse(event.body).audio;

    // 3. UPLOAD THE FILE AND START TRANSCRIPTION
    try {
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: { 'authorization': apiKey },
            body: Buffer.from(audioData, 'base64')
        });
        const uploadData = await uploadResponse.json();
        const audioUrl = uploadData.upload_url;

        if (!audioUrl) {
            return { statusCode: 500, body: 'Failed to upload audio file.' };
        }

        // 4. SUBMIT THE UPLOADED FILE FOR TRANSCRIPTION
        const transcriptResponse = await fetch(assemblyaiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ audio_url: audioUrl })
        });
        let transcriptData = await transcriptResponse.json();

        // 5. WAIT FOR THE TRANSCRIPTION TO COMPLETE
        // Transcription is not instant. We need to "poll" or check the status repeatedly.
        while (transcriptData.status !== 'completed' && transcriptData.status !== 'error') {
            // Wait for 2 seconds before checking again.
            await new Promise(resolve => setTimeout(resolve, 2000));
            const pollResponse = await fetch(`${assemblyaiEndpoint}/${transcriptData.id}`, { headers });
            transcriptData = await pollResponse.json();
        }

        if (transcriptData.status === 'error') {
            return { statusCode: 500, body: transcriptData.error };
        }

        // 6. SEND THE FINAL RESULT BACK TO THE FRONTEND
        // We'll send back the real lyrics and some placeholder tabs for now.
        const finalResult = {
            lyrics: transcriptData.text || "No lyrics found.",
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

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: 'An error occurred during transcription.'
        };
    }
    };