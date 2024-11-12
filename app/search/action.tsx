"use server"
import { Product } from "lib/shopify/types";
import OpenAI from "openai";
import { zodResponseFormat } from 'openai/helpers/zod';
import { ChatCompletionSystemMessageParam, ChatCompletionUserMessageParam } from "openai/resources/chat/completions";
import { createClient } from "utils/supabase/server";
import { z } from 'zod';
import { getFunctionCallResult, openAiTools } from "./openai_function";

const FilteredProductsSchema = z.object({
  filtered_products: z.array(z.string()),
});

export interface SimplifiedProduct {
  title: string,
  description: string,
  price: number,
}


export async function getFilteredProducts(products: Product[], searchQuery: string | undefined, reset: boolean): Promise<Product[]> {
  if (searchQuery === null || searchQuery === '' || searchQuery === undefined) {
    clearPromptsForUser();
    clearSeenProducts();
    return products;
  }

  if (reset) {
    clearPromptsForUser();
    clearSeenProducts();
  }

  const simplifiedProducts = products.map(product => ({
    title: product.handle,
    description: product.enhancedDescription?.value,
    price: parseInt(product.priceRange.maxVariantPrice.amount),
  }));

  var productPrompt = await getProductsPrompt(simplifiedProducts)
  const prompts = await existingUserPrompts();
  const seenProducts = await querySeenProducts();
  const seenPrompt = await seenSimplifiedProductContext(seenProducts, simplifiedProducts);

  const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY})

  const completion = await openai.beta.chat.completions.parse({
    messages: [      
      productPrompt,
      ...prompts,
      seenPrompt,
      {role: "user", content: `The new search query is: ${searchQuery}`},
      {role: "system", content: "When filtering by price just pick a function to call. Do not do any more processing - if user asks for products between x and y, use filter_products_price_between. Use filter_products_price_greater_than if user requests prices above x and filter_products_price_less_than for prices below y"},
      {role: "system", content: `
        You will act as an intelligent product filtering system for an ecommerce environment, designed to refine a JSON list of products based on natural language user queries. Each product in the JSON input includes "title," "description," and "price" fields.

        Users will provide sequential queries, which you should use cumulatively to filter the product list. Apply filtering logic based on common descriptors such as price, season, gender, and other relevant terms. When certain product details are unclear, infer them based on the product title, using your best judgment. If no products match the combined criteria even remotely, return nothing.

        The output should be a structured list of the products that match the cumulative filters, with each product displayed by its title, description, and price.

        Examples of cumulative filtering:

        An initial query of "fall" would filter for fall-appropriate items.
        A follow-up query of "men" would further refine to show fall items specifically for men.
        If a later query such as "comfortable" is introduced, interpret it based on existing filters, assuming relevance to prior context.
        `},
      {role: "system", content: "Provide only the filtered results that match the filter described in the filtered products field. Only include the handle of the product."},
      {role: "system", content: "Using the user's previous prompts, use them as context when filtering. For example, if user already is searching for mens clothes, do not show women's clothing even if they search for something unisex like jackets"},
      {role: "system", content: `If the user already has a set of seen products, try to determine whether we should filter on the set of seen products or the entire set of products.
          For example, if the user already is looking at shoes and then wants a pair of shorts, if it's completely unrelated, please filter against the entire product set.
          If the user query is related to the already seen set of products, only filter on the seen set of products.
        `},
        {role: "system", content: "Provide only the filtered results that match the filter described in the filtered products field. Only include the handle of the product."},
    ],
    model: "gpt-4o",
    temperature: 0,
    tools: openAiTools,
    response_format: zodResponseFormat(FilteredProductsSchema, "product_list") 
  })

  const toolCall = completion.choices[0]?.message.tool_calls?.[0];
  if (toolCall) {
    const filteredFromSeenProduct = simplifiedProducts.filter(product => seenProducts.some(productName => productName === product.title));
    const filteredProducts = getFunctionCallResult(toolCall, filteredFromSeenProduct);
    return products.filter(product => filteredProducts.some(productName => productName.title === product.handle));
  }

  const results = FilteredProductsSchema.parse(completion.choices[0]?.message.parsed);
  const { filtered_products: filteredProducts } = results;
  await insertPromptForUser(searchQuery);
  await insertFilteredProducts(filteredProducts);

  return products.filter(product => filteredProducts.some(productName => productName === product.handle));
}

async function getProductsPrompt(products: SimplifiedProduct[]): Promise<ChatCompletionSystemMessageParam>  {
  return {role: 'system', content: `All Products in the store: ${JSON.stringify(products)}`};
}

async function querySeenProducts(): Promise<string[]> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { data, error} = await supabase.from('filtered_products').select('products').eq('user_id', user?.id);
  if (data === null || data.length === 0) {
    return []
  }

  return data[0]?.products;
}

function seenSimplifiedProductContext(products: string[], allProducts: SimplifiedProduct[]): ChatCompletionSystemMessageParam {
  if (products.length === 0) {
    return {role: "system", content: `Seen Products: ${JSON.stringify(allProducts)}`};
  }
  const filtered = allProducts.filter(product => products.some(productName => productName === product.title))
  return {role: "system", content: `Seen Products: ${JSON.stringify(filtered)}`};
}

async function insertFilteredProducts(products: string[]) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  await supabase.from('filtered_products').upsert({user_id: user?.id, products: products}, {onConflict: 'user_id'});
}

async function insertPromptForUser(prompt: string | undefined) {
  if (prompt === undefined || prompt === null) {
    return;
  }

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
}

async function existingUserPrompts(): Promise<ChatCompletionUserMessageParam[]> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const {data, error}  = await supabase.from('prompts').select('prompts').eq('user_id', user?.id);
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
}

async function clearSeenProducts() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { error } =  await supabase.from('filtered_products').update({products: []}).eq('user_id', user?.id)
}

