import {
  Flex,
  IconButton,
  VStack,
  Box,
  Card,
  CardBody,
  Avatar,
  useToast,
  Textarea,
  Text,
} from "@chakra-ui/react";
import { SendIcon, MicIcon } from "lucide-react";
import React, { useState } from "react";
import MessageRenderer from "./components/message/MessageRenderer";

const ChatView = ({ sessionID }) => {
  const userImageURL = frappe.user.image();
  const userFullname = frappe.user.full_name();
  const toast = useToast();
  const [promptMessage, setPromptMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "ai",
      isLoading: false,
      content: "Hello! How can I help you today?",
    },
  ]);
  const [isListening, setIsListening] = useState(false); // Track microphone status

  // Function to handle sending a message
  const handleSendMessage = () => {
    if (!promptMessage.trim().length) return;

    setMessages((old) => [
      ...old,
      { from: "human", content: promptMessage, isLoading: false },
      { from: "ai", content: "", isLoading: true },
    ]);
    setPromptMessage("");

    frappe
      .call("doppio_bot.api.get_chatbot_response", {
        prompt_message: promptMessage,
        session_id: sessionID,
      })
      .then((response) => {
        setMessages((old) => {
          const updated = [...old];
          updated.splice(updated.length - 1, 1, {
            from: "ai",
            content: response.message || "(No response)",
            isLoading: false,
          });
          return updated;
        });
      })
      .catch((e) => {
        console.error(e);
        toast({
          title: "Something went wrong, check the console for details.",
          status: "error",
          position: "bottom-right",
        });
      });
  };

  const handleVoiceInput = () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    toast({
      title: "Speech recognition is not supported in this browser.",
      status: "error",
      position: "bottom-right",
    });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US"; // Set recognition language
  recognition.interimResults = false; // Only send final results
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    console.log("Speech recognition started. Speak now...");
    setIsListening(true);
    toast({
      title: "Listening...",
      status: "info",
      position: "bottom-right",
      duration: 2000,
    });
  };

  recognition.onend = () => {
    console.log("Speech recognition ended.");
    setIsListening(false);
  };

  recognition.onresult = (event) => {
    const spokenText = event.results[0][0].transcript;
    console.log("Recognized text:", spokenText);
    setPromptMessage(spokenText);

    // Automatically send the message
    setTimeout(() => {
      handleSendMessage();
    }, 500);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);

    const errorMessages = {
      "no-speech": "No speech detected. Please try again.",
      "audio-capture": "Microphone access is required to use voice input.",
      "not-allowed":
        "Permission denied. Please enable microphone access in your browser settings.",
    };

    toast({
      title: errorMessages[event.error] || "Voice input failed. Please try again.",
      status: "error",
      position: "bottom-right",
    });
  };

  recognition.start();
};


  return (
    <Flex
      direction="column"
      height="77vh"
      width="100%"
      maxWidth="4xl"
      mx="auto"
      backgroundColor="gray.100"
      p="4"
      border="1px solid #e2e8f0"
      rounded="lg"
    >
      <Text fontSize="xl" fontWeight="bold" color="gray.700" mb="4">
        Ask Aqiq Ai
      </Text>
      {/* Chat Area */}
      <Box
        flex="1"
        width="100%"
        overflowY="scroll"
        shadow="xl"
        rounded="md"
        backgroundColor="white"
        border="1px solid #e2e8f0"
        p="4"
      >
        <VStack spacing={4} align="stretch">
          {messages.map((message, index) => (
            <Flex
              key={index}
              alignSelf={message.from === "human" ? "flex-end" : "flex-start"}
              maxWidth="70%"
              borderRadius="md"
              backgroundColor={
                message.from === "human" ? "blue.500" : "gray.700"
              }
              color="white"
              p="3"
              shadow="sm"
            >
              {message.isLoading ? (
                <Text color="gray.500" fontStyle="italic">
                  Typing...
                </Text>
              ) : (
                <MessageRenderer content={message.content || "(No response)"} />
              )}
            </Flex>
          ))}
        </VStack>
      </Box>

      {/* Prompt Area */}
      <Card mt="4">
        <CardBody>
          <Flex gap="4" alignItems="center">
            <Avatar name={userFullname} size="sm" src={userImageURL} />
            <Textarea
              value={promptMessage}
              onChange={(event) => setPromptMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message here..."
              flex="1"
              resize="none"
            />
            <IconButton
              aria-label="Use Microphone"
              icon={<MicIcon height={16} />}
              onClick={handleVoiceInput}
              colorScheme={isListening ? "red" : "teal"} // Red if listening
              variant="solid"
            />
            <IconButton
              aria-label="Send Prompt Message"
              icon={<SendIcon height={16} />}
              onClick={handleSendMessage}
              colorScheme="blue"
              variant="solid"
            />
          </Flex>
          {isListening && (
            <Text fontSize="sm" color="blue.500" fontStyle="italic" mt="2">
              Listening...
            </Text>
          )}
        </CardBody>
      </Card>
    </Flex>
  );
};

export default ChatView;
