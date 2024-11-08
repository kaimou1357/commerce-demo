"use server"
import { Product } from "lib/shopify/types";
import OpenAI from "openai";
import { zodResponseFormat } from 'openai/helpers/zod';
import { ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";
import { createClient } from "utils/supabase/server";
import { z } from 'zod';

const FilteredProductsSchema = z.object({
  filtered_products: z.array(z.string()),
  reasoning: z.string(),
});

interface SimplifiedProduct {
  id: string,
  title: string,
  description: string,
  price: string,
}


export async function getFilteredProducts(products: Product[], searchQuery: string | undefined, reset: boolean): Promise<Product[]> {
  if (searchQuery === null || searchQuery === '') {
    clearFiltersForUser();
    return products;
  }

  if (reset) {
    clearFiltersForUser();
  }

  const simplifiedProducts = products.map(product => ({
    id: product.id,
    title: product.handle,
    description: product.enhancedDescription?.value,
    price: product.priceRange.maxVariantPrice.amount,
  }));

  var productPrompt = await getPreviousProductsForUser(simplifiedProducts)


  const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})

  const chatCompletion = await openai.beta.chat.completions.parse({
    messages: [      
      productPrompt,
      {role: "user", content: `The query is: ${searchQuery}`},
      {role: "system", content: `
        You are an intelligent e-commerce sales agent specializing in understanding user intent and providing personalized shopping recommendations for clothing. Take into context the pre-existing user queries when making decisions to try to piece together their need.
        Your job is to carefully consider each user’s input, analyze their context (like formal vs casual events), and present only relevant results that match their specific needs.
        When a user provides a prompt like ‘I’m going to a wedding,’ recognize that this implies a formal event and suggest formal attire like tuxedos, suits, or dresses, unless they provide additional context that implies a different need. 
        For example, if they say ‘I’m going to get dirty at the wedding,’ switch to recommending less formal, more durable options, like casual outfits or clothing suited for outdoor or non-traditional settings.
        Always prioritize context over individual keywords. For example, the word ‘wedding’ doesn’t always mean formal, and the phrase ‘get dirty’ indicates they may want practical or casual clothing. 
        Your task is to balance the user’s stated purpose with their environment and give recommendations that fit both. The goal is to make the shopping experience feel like a conversation with a highly experienced sales agent who can understand subtle cues, anticipate needs, and provide tailored product suggestions. `},
      {role: "system", content: "Please also include the reasoning of how you obtained the results in the reasoning field in the output"},
      {role: "system", content: "When user filters on price, please just read the price column to determine the price to filter. Verify the price on each product - even if the names are similar. DO NOT INCLUDE ANYTHING ABOVE BUDGET"},
      {role: "system", content: "In the output - return only the title field of the products that adhere to the user criteria."},
      {role: "system", content: "please ensure that the filtered products list only contains the products after you applied your filters"}
      
    ],
    model: "gpt-4o",
    temperature: 0,
    response_format: zodResponseFormat(FilteredProductsSchema, "product_list") 
  });

  const results = FilteredProductsSchema.parse(chatCompletion.choices[0]?.message.parsed);
  const filteredProducts = results.filtered_products;
  console.log(results);

  insertProductsForUser(filteredProducts);

  return products.filter(product => filteredProducts.some(productName => productName === product.handle));
}

async function getPreviousProductsForUser(products: SimplifiedProduct[]): Promise<ChatCompletionSystemMessageParam>  {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { data , error} = await supabase.from('filtered_products').select().eq('owner_id', user?.id).limit(1)
  if (error || data === null || data.length === 0) {
    return {role: 'system', content: JSON.stringify(products)}
  }

  const record = data[0];
  const previousFilteredProducts = record.products;
  if (previousFilteredProducts.length === 0) {
    return {role: 'system', content: JSON.stringify(products)}
  }

  const result = products.filter(product => previousFilteredProducts.some((productName: string) => productName === product.title));
  return {role: 'system', content: `The starting product list you will be filtering from: ${JSON.stringify(result)}`};
}

async function insertProductsForUser(productIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  await supabase.from('filtered_products').upsert({owner_id: user?.id, products: productIds}, {onConflict: 'owner_id'});
}

async function clearFiltersForUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  await supabase.from('filtered_products').update({products: []}).eq('owner_id', user?.id)
}