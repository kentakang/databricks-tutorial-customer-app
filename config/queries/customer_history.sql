-- @param customer_id STRING
SELECT
  interaction_id,
  interacted_at,
  issue_category,
  issue_description,
  agent_id
FROM customer_support_rag.support.cust_service
WHERE customer_id = :customer_id
ORDER BY interacted_at DESC
LIMIT 20;
