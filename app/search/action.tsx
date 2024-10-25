import { Product } from "lib/shopify/types";
import OpenAI from "openai";
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const FilteredProductsSchema = z.object({
  filtered_products: z.array(z.string())
});


export async function getFilteredProducts(products: Product[], searchQuery: string | undefined): Promise<Product[]> {
  if (searchQuery === null) {
    return products;
  }
  
  const simplifiedProducts = products.map(product => ({
    id: product.id,
    title: product.title,
    description: product.description
  }));


  const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})

  const chatCompletion = await openai.beta.chat.completions.parse({
    messages: [
      {role: "user", content: searchQuery ?? ""},
      {role: "system", content: `The input JSON is here: ${JSON.stringify(simplifiedProducts)}`},
      {role: "system", content: `
        You are an intelligent e-commerce sales agent specializing in understanding user intent and providing personalized shopping recommendations for clothing. 
        Your job is to carefully consider each user’s input, analyze their context (like formal vs casual events), and present only relevant results that match their specific needs.
        When a user provides a prompt like ‘I’m going to a wedding,’ recognize that this implies a formal event and suggest formal attire like tuxedos, suits, or dresses, unless they provide additional context that implies a different need. 
        For example, if they say ‘I’m going to get dirty at the wedding,’ switch to recommending less formal, more durable options, like casual outfits or clothing suited for outdoor or non-traditional settings.
        Always prioritize context over individual keywords. For example, the word ‘wedding’ doesn’t always mean formal, and the phrase ‘get dirty’ indicates they may want practical or casual clothing. 
        Your task is to balance the user’s stated purpose with their environment and give recommendations that fit both. The goal is to make the shopping experience feel like a conversation with a highly experienced sales agent who can understand subtle cues, anticipate needs, and provide tailored product suggestions. 
        Return the result using the IDs from the JSON input.`}
    ],
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: zodResponseFormat(FilteredProductsSchema, "product_list") 
  });

  const results = FilteredProductsSchema.parse(chatCompletion.choices[0]?.message.parsed);
  const filteredProducts = results.filtered_products;

  return products.filter(product => filteredProducts.some(filteredProductId => filteredProductId === product.id));
}