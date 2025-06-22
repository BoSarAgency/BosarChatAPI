import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatMessage } from '@prisma/client';
import OpenAI from 'openai';
import { BotSettingsService } from '../bot-settings/bot-settings.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

export interface AiResponse {
  message: string;
  shouldTriggerHumanTakeover?: boolean;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private botSettingsService: BotSettingsService,
    private knowledgeBaseService: KnowledgeBaseService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not found in environment variables');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key', // Use dummy key if not provided to prevent crashes
    });
  }

  async generateResponse(
    userMessage: string,
    conversationHistory: ChatMessage[],
    botSettingsId?: string,
  ): Promise<AiResponse> {
    try {
      // Get bot settings - use provided botSettingsId or fallback to latest
      let botSettings;
      if (botSettingsId) {
        botSettings = await this.botSettingsService.findOne(botSettingsId);
      } else {
        botSettings = await this.botSettingsService.getLatest();
      }

      if (!botSettings) {
        throw new Error('No bot settings found');
      }

      // Load all FAQs for this bot
      const faqContext = botSettings.faqs
        .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
        .join('\n\n');

      // Search knowledge base for relevant information
      const knowledgeResults = await this.knowledgeBaseService.search({
        query: userMessage,
        limit: 5,
        threshold: 0.7,
      });

      // Build context from knowledge base
      const knowledgeContext = knowledgeResults
        .map((result) => `${result.source}: ${result.content}`)
        .join('\n\n');

      // Build conversation history for context
      const conversationContext = conversationHistory
        .slice(-10) // Last 10 messages for context
        .map((msg) => {
          const role = msg.role === 'user' ? 'user' : 'assistant';
          return { role, content: msg.message };
        });

      // Build system message
      let systemMessage = botSettings.systemInstructions;

      if (faqContext) {
        systemMessage += `\n\nFAQ Context:\n${faqContext}`;
      }
      if (knowledgeContext) {
        systemMessage += `\n\nKnowledge Base Context:\n${knowledgeContext}`;
      }

      // console.log('SYSTEM MESSAGE:');
      // console.log(systemMessage);
      // console.log('=======');

      // Prepare messages for OpenAI
      const messages = [
        { role: 'system', content: systemMessage },
        ...conversationContext,
        { role: 'user', content: userMessage },
      ];

      // Check if OpenAI API key is available
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        // Return a fallback response when no API key is configured
        return {
          message:
            "I'm sorry, I'm currently unable to process your request. Please contact a human agent for assistance.",
          shouldTriggerHumanTakeover: true,
        };
      }

      // Prepare tools for OpenAI API if available
      const tools = this.formatToolsForOpenAI(botSettings.tools);

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: botSettings.model || 'gpt-3.5-turbo',
        messages: messages as any,
        temperature: botSettings.temperature || 0.7,
        max_tokens: 500,
        ...(tools.length > 0 && { tools }),
      });

      const message = completion.choices[0]?.message;
      let aiResponse =
        message?.content ||
        "I'm sorry, I couldn't generate a response. Please try again.";
      let shouldTriggerHumanTakeover = false;

      // Handle tool calls if present
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCallResult = await this.handleToolCalls(message.tool_calls);
        aiResponse = toolCallResult.message;
        shouldTriggerHumanTakeover =
          toolCallResult.shouldTriggerHumanTakeover || false;
      } else {
        // Check if response indicates need for human takeover
        shouldTriggerHumanTakeover = this.shouldTriggerHumanTakeover(
          userMessage,
          aiResponse,
        );
      }

      return {
        message: aiResponse,
        shouldTriggerHumanTakeover,
      };
    } catch (error) {
      this.logger.error('Error generating AI response:', error);

      // Return fallback response on error
      return {
        message:
          "I'm experiencing technical difficulties. Let me connect you with a human agent.",
        shouldTriggerHumanTakeover: true,
      };
    }
  }

  private formatToolsForOpenAI(tools: any): any[] {
    if (!tools || !Array.isArray(tools)) {
      return [];
    }

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    }));
  }

  private async handleToolCalls(toolCalls: any[]): Promise<AiResponse> {
    for (const toolCall of toolCalls) {
      const functionName = toolCall.function?.name;

      if (functionName === 'request_human_agent') {
        // Parse the arguments to get user reason if provided
        let userReason = '';
        try {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          userReason = args.user_reason || '';
        } catch (error) {
          this.logger.warn('Failed to parse tool call arguments:', error);
        }

        return {
          message: userReason
            ? `I understand you'd like to speak with a human agent. I'll connect you with someone who can help with: ${userReason}`
            : "I'll connect you with a human agent who can better assist you.",
          shouldTriggerHumanTakeover: true,
        };
      }
    }

    // If no recognized tool calls, return default response
    return {
      message:
        "I've processed your request, but I'm not sure how to respond. Let me connect you with a human agent.",
      shouldTriggerHumanTakeover: true,
    };
  }

  private shouldTriggerHumanTakeover(
    userMessage: string,
    aiResponse: string,
  ): boolean {
    // Keywords that indicate user wants human help
    const humanKeywords = [
      'speak to human',
      'talk to agent',
      'human agent',
      'real person',
      'customer service',
      'representative',
      'escalate',
      'speak to someone',
      'talk to someone',
      'human help',
      'live agent',
    ];

    // Keywords in AI response that indicate it can't help
    const aiLimitationKeywords = [
      'cannot help',
      'unable to assist',
      'beyond my capabilities',
      'need human assistance',
      'contact support',
      'speak with agent',
    ];

    const lowerUserMessage = userMessage.toLowerCase();
    const lowerAiResponse = aiResponse.toLowerCase();

    return (
      humanKeywords.some((keyword) => lowerUserMessage.includes(keyword)) ||
      aiLimitationKeywords.some((keyword) => lowerAiResponse.includes(keyword))
    );
  }
}
