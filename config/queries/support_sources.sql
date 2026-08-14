-- @param query_text STRING
SELECT
  document_id,
  source_type,
  source_id,
  title,
  content,
  source_uri
FROM vector_search(
  index => 'customer_support_rag.support.support_docs_index',
  query_text => :query_text,
  num_results => 5,
  query_type => 'hybrid'
);
