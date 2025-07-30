// This is our serverless function.
// It will be triggered when our frontend calls its URL.

exports.handler = async function(event, context) {
    // For now, we are not doing any real transcription.
    // We are just sending back a "mock" or "fake" package of data.
    // This lets us test our wiring before we connect to a real API.

    const mockTranscription = {
        lyrics: "Hello from the backend server!",
        tabs: [
            "e|----------------------------------|",
            "B|------1-0-----------------------|",
            "G|----0-----2-0-------------------|",
            "D|--2-----------4-2---------------|",
            "A|3-----------------5-3-----------|",
            "E|----------------------------------|"
        ]
    };

    // This is the standard way to send a successful response from a serverless function.
    // We send a status code of 200 (which means "OK") and the data in JSON format.
    return {
        statusCode: 200,
        body: JSON.stringify(mockTranscription)
    };
}