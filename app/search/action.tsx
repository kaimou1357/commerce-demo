"use server"
import { Product } from "lib/shopify/types";
import OpenAI from "openai";
import { zodResponseFormat } from 'openai/helpers/zod';
import { ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam } from "openai/resources/chat/completions";
import { createClient } from "utils/supabase/server";
import { z } from 'zod';

const FilteredProductsSchema = z.object({
  filtered_products: z.array(z.string()),
  reasoning: z.string(),
});

interface SimplifiedProduct {
  title: string,
  description: string,
  price: string,
}


export async function getFilteredProducts(products: Product[], searchQuery: string | undefined, reset: boolean): Promise<Product[]> {
  if (searchQuery === null || searchQuery === '' || searchQuery === undefined) {
    clearPromptsForUser();
    return products;
  }

  if (reset) {
    clearPromptsForUser();
  }

  const simplifiedProducts = products.map(product => ({
    title: product.handle,
    description: product.enhancedDescription?.value,
    price: product.priceRange.maxVariantPrice.amount,
  }));

  var productPrompt = await getProductsPrompt(simplifiedProducts)
  const prompts = await existingUserPrompts();

  const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})

  const chatCompletion = await openai.beta.chat.completions.parse({
    messages: [      
      productPrompt,
      ...prompts,
      {role: "user", content: `The new search query is: ${searchQuery}`},
      {role: "system", content: `
        You are an intelligent e-commerce sales agent specializing in understanding user intent and providing personalized shopping recommendations for clothing. Take into context the pre-existing user queries when making decisions to try to piece together their need.
        Your job is to carefully consider each user’s input, analyze their context (like formal vs casual events), and present only relevant results that match their specific needs.
        When a user provides a prompt like ‘I’m going to a wedding,’ recognize that this implies a formal event and suggest formal attire like tuxedos, suits, or dresses, unless they provide additional context that implies a different need. 
        For example, if they say ‘I’m going to get dirty at the wedding,’ switch to recommending less formal, more durable options, like casual outfits or clothing suited for outdoor or non-traditional settings.
        Always prioritize context over individual keywords. For example, the word ‘wedding’ doesn’t always mean formal, and the phrase ‘get dirty’ indicates they may want practical or casual clothing. 
        Your task is to balance the user’s stated purpose with their environment and give recommendations that fit both. The goal is to make the shopping experience feel like a conversation with a highly experienced sales agent who can understand subtle cues, anticipate needs, and provide tailored product suggestions. `},
      {role: "system", content: "Provide the filtered results in the filtered products field. Only include the handle of the product."},
      {role: "system", content: "When filtering by price - make sure that the price is actually under what the user determines"},
      {role: "system", content: "Using the user's previous prompts, use them as context when filtering. For example, if user already is searching for mens clothes, do not show women's clothing even if they search for something unisex like jackets"},
    ],
    model: "gpt-4o",
    temperature: 0,
    response_format: zodResponseFormat(FilteredProductsSchema, "product_list") 
  });

  const results = FilteredProductsSchema.parse(chatCompletion.choices[0]?.message.parsed);
  const filteredProducts = results.filtered_products;
  console.log(results);

  await insertPromptForUser(searchQuery);

  return products.filter(product => filteredProducts.some(productName => productName === product.handle));
}

async function getProductsPrompt(products: SimplifiedProduct[]): Promise<ChatCompletionSystemMessageParam>  {
  return {role: 'system', content: `All Products in the store: ${JSON.stringify(products)}`};
}

async function insertPromptForUser(prompt: string | undefined) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { data: promptData } = await supabase
    .from('prompts')
    .select('prompts')
    .eq('user_id', user?.id)
    .single()
  
  const updatedPrompts = promptData?.prompts ? [...promptData.prompts, prompt] : [prompt]

  const { error } = await supabase.from('prompts').upsert({user_id: user?.id, prompts: updatedPrompts}, {onConflict: 'user_id'});
  console.log(error);
}

async function existingUserPrompts(): Promise<ChatCompletionUserMessageParam[]> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const {data, error}  = await supabase.from('prompts').select('prompts').eq('user_id', user?.id);
  console.log(error);
  if (data === null || data.length === 0) {
    return []
  }

  const prompts = data[0]?.prompts

  return prompts.map((prompt: any) => ({role: "user", content: prompt }));
}

async function clearPromptsForUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { error } =  await supabase.from('prompts').update({prompts: []}).eq('user_id', user?.id)
  console.log(error);
}