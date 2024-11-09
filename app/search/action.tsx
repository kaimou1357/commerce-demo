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
  price: number,
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
    price: parseInt(product.priceRange.maxVariantPrice.amount),
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
        You will act as an intelligent product filtering system for an ecommerce environment, designed to refine a JSON list of products based on natural language user queries. Each product in the JSON input includes "title," "description," and "price" fields.

        Users will provide sequential queries, which you should use cumulatively to filter the product list. Apply filtering logic based on common descriptors such as price, season, gender, and other relevant terms. When certain product details are unclear, infer them based on the product title, using your best judgment. If no products match the combined criteria even remotely, return nothing.

        The output should be a structured list of the products that match the cumulative filters, with each product displayed by its title, description, and price. Additionally, include reasoning on how the final product list was determined.

        Examples of cumulative filtering:

        An initial query of "fall" would filter for fall-appropriate items.
        A follow-up query of "men" would further refine to show fall items specifically for men.
        If a later query such as "comfortable" is introduced, interpret it based on existing filters, assuming relevance to prior context.
        `},
      {role: "system", content: "Provide only the filtered results that match the filter described in the filtered products field. Only include the handle of the product."},
      {role: "system", content: "When filtering by price - please think through it step-by-step. When filtering between prices, please think through it step-by-step. At the end - verify the products against the filtered price request."},
      {role: "system", content: "Using the user's previous prompts, use them as context when filtering. For example, if user already is searching for mens clothes, do not show women's clothing even if they search for something unisex like jackets"},
      {role: "system", content: "Please provide the price of the product in the reasoning why you picked each product. Run this check before you add the product to the filter."}
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
}