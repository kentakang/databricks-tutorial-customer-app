-- @param customer_id STRING
SELECT
  o.transaction_id,
  o.ordered_at,
  o.delivery_address,
  o.product_id,
  coalesce(pd.product_name, o.product_name_raw) AS product_name,
  pd.product_category,
  pd.product_sub_category
FROM customer_support_rag.support.orders AS o
LEFT JOIN customer_support_rag.support.product_docs AS pd
  ON pd.product_id = o.product_id
WHERE o.customer_id = :customer_id
ORDER BY o.ordered_at DESC
LIMIT 20;
